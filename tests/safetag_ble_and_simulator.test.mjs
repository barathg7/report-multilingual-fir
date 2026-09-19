// tests/safetag_ble_and_simulator.test.mjs
// Automated Test Suite for SafeTag BLE Hardware Protocol and Simulator Engine

import assert from "node:assert/strict";
import {
  SAFETAG_BLE_UUIDS,
  SAFETAG_EVENT_TYPES,
  SAFETAG_TIMINGS,
  validateSafeTagPacket,
  buildSafeTagPacket,
  buildDownlinkAckPayload
} from "../src/lib/safeTag/safeTagProtocol.js";
import { SafeTagSimulator } from "../src/lib/safeTag/safeTagSimulator.js";

console.log("==================================================================");
console.log("RUNNING SAFETAG BLE PROTOCOL & SIMULATOR ENGINE TESTS");
console.log("==================================================================");

let passedCount = 0;
let failedCount = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${testName}`);
    passedCount++;
  } catch (err) {
    console.error(`❌ FAIL: ${testName}`);
    console.error(err);
    failedCount++;
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${testName}`);
    passedCount++;
  } catch (err) {
    console.error(`❌ FAIL: ${testName}`);
    console.error(err);
    failedCount++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — SafeTag BLE GATT Architecture & UUIDs
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 1: SafeTag BLE UUIDs conform to 128-bit GATT profile specifications", () => {
  assert.ok(SAFETAG_BLE_UUIDS.SERVICE_EMERGENCY, "Emergency service UUID defined");
  assert.ok(SAFETAG_BLE_UUIDS.CHAR_TRIGGER_EVENT, "Trigger event char UUID defined");
  assert.ok(SAFETAG_BLE_UUIDS.CHAR_POLICE_ACK, "Police ack char UUID defined");
  assert.ok(SAFETAG_BLE_UUIDS.CHAR_DEVICE_TELEMETRY, "Telemetry char UUID defined");

  // Verify GATT UUID format (standard 8-4-4-4-12 hex string)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  assert.match(SAFETAG_BLE_UUIDS.SERVICE_EMERGENCY, uuidRegex);
  assert.match(SAFETAG_BLE_UUIDS.CHAR_TRIGGER_EVENT, uuidRegex);
  assert.match(SAFETAG_BLE_UUIDS.CHAR_POLICE_ACK, uuidRegex);
  assert.match(SAFETAG_BLE_UUIDS.CHAR_DEVICE_TELEMETRY, uuidRegex);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — Protocol Timings & Downstream 2-Pulse Vibration Pattern
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 2: SafeTag timings enforce debounce, long-press, and 2-pulse ack vibration", () => {
  assert.equal(SAFETAG_TIMINGS.DEBOUNCE_MS, 50);
  assert.equal(SAFETAG_TIMINGS.LONG_PRESS_THRESHOLD_MS, 3000);
  assert.equal(SAFETAG_TIMINGS.DOUBLE_PRESS_MAX_INTERVAL_MS, 400);
  assert.equal(SAFETAG_TIMINGS.ACK_VIBRATION_PULSES, 2);

  // Vibration pattern: 2 pulses [300ms, 150ms, 300ms]
  assert.deepEqual(SAFETAG_TIMINGS.ACK_VIBRATION_PATTERN_MS, [300, 150, 300]);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — BLE Packet Schema Validation & Rejection of Malformed Payloads
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 3: validateSafeTagPacket validates correct packets and rejects corrupt telemetry", () => {
  const validPacket = buildSafeTagPacket({
    deviceId: "ESP32-SAFETAG-001",
    eventType: SAFETAG_EVENT_TYPES.SOS_GENERAL,
    batteryLevel: 88,
    sequenceNumber: 1
  });

  const resValid = validateSafeTagPacket(validPacket);
  assert.equal(resValid.valid, true);
  assert.equal(resValid.errors.length, 0);

  // Missing deviceId
  const bad1 = { ...validPacket, device_id: "" };
  assert.equal(validateSafeTagPacket(bad1).valid, false);

  // Invalid battery
  const bad2 = { ...validPacket, battery_level: 150 };
  assert.equal(validateSafeTagPacket(bad2).valid, false);

  // Invalid event type
  const bad3 = { ...validPacket, event_type: "INVALID_UNKNOWN_TYPE" };
  assert.equal(validateSafeTagPacket(bad3).valid, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — Downlink Police Ack Payload Generation
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 4: buildDownlinkAckPayload packages command center acknowledgment", () => {
  const downlink = buildDownlinkAckPayload({
    sosId: "sos-test-123",
    stationCode: "TN-CHN-001",
    stationName: "Adyar Police Station",
    officerBadge: "SI-204"
  });

  assert.equal(downlink.ack, true);
  assert.equal(downlink.sos_id, "sos-test-123");
  assert.equal(downlink.station_code, "TN-CHN-001");
  assert.equal(downlink.station_name, "Adyar Police Station");
  assert.equal(downlink.officer_badge, "SI-204");
  assert.equal(downlink.vibration_pulses, 2);
  assert.deepEqual(downlink.vibration_pattern_ms, [300, 150, 300]);
  assert.ok(downlink.timestamp);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — SafeTag Simulator Input Triggering & CIE Linking
// ─────────────────────────────────────────────────────────────────────────────
await runAsyncTest("TEST 5: SafeTagSimulator triggers SOS events and tracks state", async () => {
  let vibrationEvent = null;
  const sim = new SafeTagSimulator({
    deviceId: "SIM-ESP32-UNIT-7",
    batteryLevel: 95,
    onVibrationSimulated: (msg) => {
      vibrationEvent = msg;
    }
  });

  // Trigger double-press (Immediate physical threat)
  const res = await sim.triggerInput("DOUBLE_PRESS", { lat: 13.0827, lng: 80.2707, accuracy: 5 });
  assert.ok(res.success, "Simulator trigger must succeed");
  assert.equal(res.packet.event_type, SAFETAG_EVENT_TYPES.SOS_PHYSICAL_THREAT);
  assert.equal(res.packet.device_id, "SIM-ESP32-UNIT-7");
  assert.equal(res.packet.sequence_number, 1);
  assert.ok(res.incident, "Incident must be linked in simulator");

  // Test police downlink acknowledgement simulation
  sim.handlePoliceAcknowledgement();

  assert.equal(sim.policeAckReceived, true);
  assert.ok(vibrationEvent, "Vibration callback must be invoked on police ack");
  assert.match(vibrationEvent.message || "", /2× vibration acknowledgement simulated/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6 — SafeTag Simulator Cancellation Flow
// ─────────────────────────────────────────────────────────────────────────────
await runAsyncTest("TEST 6: SafeTagSimulator handles false-alarm cancellation", async () => {
  const sim = new SafeTagSimulator({ deviceId: "SIM-ESP32-CANCEL-TEST" });

  await sim.triggerInput("LONG_PRESS");
  assert.ok(sim.activeIncident);

  const cancelRes = await sim.triggerInput("CANCEL");
  assert.equal(cancelRes.success, true);
  assert.equal(cancelRes.cancelled, true);
  assert.equal(sim.activeIncident, null);
});

console.log("\n==================================================================");
console.log(`TEST SUMMARY: ${passedCount} passed, ${failedCount} failed`);
console.log("==================================================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
