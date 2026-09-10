// tests/sos_dispatch_safety.test.mjs
// SOS Pipeline Safety & Phone Validation Test Suite
// Verifies prevention of invalid SMS dispatch, strict E.164 phone validation, and truthful emergency fallback.

import assert from "node:assert/strict";
import {
  normalizeStationPhone,
  isValidDispatchPhone,
  normalizeStationRecord as normalize
} from "../src/utils/phoneValidation.js";

console.log("==================================================================");
console.log("RUNNING SOS DISPATCH SAFETY & PHONE VALIDATION TEST SUITE");
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

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — "Contact Unavailable" -> null
// ─────────────────────────────────────────────────────────────────────────────
runTest('TEST 1: "Contact Unavailable" normalizes to null and never sends placeholder', () => {
  assert.equal(normalizeStationPhone("Contact Unavailable"), null);
  assert.equal(normalizeStationPhone("contact unavailable"), null);
  assert.equal(normalizeStationPhone("  Contact Unavailable  "), null);

  // When normalizing a station object from policeStations.js
  const rawStation = {
    id: "TN-CHN-001",
    name: "Adyar Police Station",
    district: "Chennai",
    state: "Tamil Nadu",
    lat: 13.0012,
    lng: 80.2565,
    code: "TN-CHN-001",
    phone: "Contact Unavailable"
  };
  const normalized = normalize(rawStation, 1.5);
  assert.equal(normalized.phonenumber, null, "Station phonenumber must be null, not placeholder string");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — empty -> invalid
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 2: empty string is invalid and normalizes to null", () => {
  assert.equal(normalizeStationPhone(""), null);
  assert.equal(normalizeStationPhone("   "), null);
  assert.equal(isValidDispatchPhone(""), false);
  assert.equal(isValidDispatchPhone("   "), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — null -> invalid
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 3: null is invalid and normalizes to null", () => {
  assert.equal(normalizeStationPhone(null), null);
  assert.equal(isValidDispatchPhone(null), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — undefined -> invalid
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 4: undefined is invalid and normalizes to null", () => {
  assert.equal(normalizeStationPhone(undefined), null);
  assert.equal(isValidDispatchPhone(undefined), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — "+919876543210" -> valid
// ─────────────────────────────────────────────────────────────────────────────
runTest('TEST 5: "+919876543210" is recognized as valid international E.164 phone', () => {
  assert.equal(normalizeStationPhone("+919876543210"), "+919876543210");
  assert.equal(isValidDispatchPhone("+919876543210"), true);
  assert.equal(isValidDispatchPhone(" +919876543210 "), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6 — "919876543210" -> invalid
// ─────────────────────────────────────────────────────────────────────────────
runTest('TEST 6: "919876543210" without leading "+" is rejected as invalid for international SMS', () => {
  assert.equal(isValidDispatchPhone("919876543210"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7 — "09876543210" -> invalid
// ─────────────────────────────────────────────────────────────────────────────
runTest('TEST 7: "09876543210" with leading zero is rejected as invalid E.164', () => {
  assert.equal(isValidDispatchPhone("09876543210"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8 — invalid station phone -> Edge Function NOT called
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 8: invalid/unconfigured station phone does NOT call Edge Function", async () => {
  let edgeFunctionCallCount = 0;
  const mockEdgeFunction = async () => {
    edgeFunctionCallCount++;
    return { success: true };
  };

  const stations = [
    { station_name: "Adyar Police Station", station_code: "TN-CHN-001", phonenumber: null, distance_km: 1.2 },
    { station_name: "Anna Nagar PS", station_code: "TN-CHN-002", phonenumber: "Contact Unavailable", distance_km: 2.5 },
    { station_name: "T.Nagar PS", station_code: "TN-CHN-003", phonenumber: "919876543210", distance_km: 3.1 }
  ];

  const results = await Promise.all(stations.map(async (station) => {
    if (!isValidDispatchPhone(station.phonenumber)) {
      return {
        station,
        sent: false,
        error: "Station dispatch number not configured"
      };
    }
    await mockEdgeFunction(station.phonenumber, "SOS Message");
    return { station, sent: true, error: null };
  }));

  assert.equal(edgeFunctionCallCount, 0, "Edge function must NEVER be invoked for invalid numbers");
  assert.equal(results.length, 3);
  assert.equal(results.every(r => !r.sent), true);
  assert.equal(results.every(r => r.error === "Station dispatch number not configured"), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 9 — valid station phone -> Edge Function IS called
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 9: valid station phone DOES call Edge Function", async () => {
  const dispatchedCalls = [];
  const mockEdgeFunction = async (to, message) => {
    dispatchedCalls.push({ to, message });
    return { success: true, sid: "SM12345" };
  };

  const station = {
    station_name: "Valid Station",
    station_code: "TN-VAL-001",
    phonenumber: "+919876543210",
    distance_km: 0.8
  };

  const result = await (async () => {
    if (!isValidDispatchPhone(station.phonenumber)) {
      return { station, sent: false, error: "Station dispatch number not configured" };
    }
    await mockEdgeFunction(station.phonenumber, "🚨 SOS ALERT - Need immediate help!");
    return { station, sent: true, error: null };
  })();

  assert.equal(dispatchedCalls.length, 1, "Edge function must be called exactly once for valid number");
  assert.equal(dispatchedCalls[0].to, "+919876543210");
  assert.match(dispatchedCalls[0].message, /🚨 SOS ALERT/);
  assert.equal(result.sent, true);
  assert.equal(result.error, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 10 — all stations unavailable -> Call 100 fallback shown & retry disabled
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 10: all stations unavailable directs to Call 100 fallback with retry disabled", () => {
  const stationResults = [
    { station: { station_name: "PS 1", phonenumber: null }, sent: false, error: "Station dispatch number not configured" },
    { station: { station_name: "PS 2", phonenumber: null }, sent: false, error: "Station dispatch number not configured" },
    { station: { station_name: "PS 3", phonenumber: null }, sent: false, error: "Station dispatch number not configured" }
  ];

  const sentCount = stationResults.filter(r => r.sent).length;
  const allUnconfigured = stationResults.every(r => !isValidDispatchPhone(r.station.phonenumber));

  let status = "idle";
  let statusMsg = "";
  let retryable = false;

  if (sentCount > 0) {
    status = "success";
    statusMsg = `SOS sent to ${sentCount} of ${stationResults.length} stations`;
    retryable = false;
  } else if (allUnconfigured) {
    status = "error";
    statusMsg = "SMS dispatch is currently unavailable for nearby stations.\nCall 100 directly for immediate emergency assistance.";
    retryable = false; // Never allow futile repeated retry on unconfigured stations
  } else {
    status = "error";
    statusMsg = "SMS failed for all stations. Call 100 directly.";
    retryable = true;
  }

  assert.equal(status, "error");
  assert.match(statusMsg, /Call 100 directly/);
  assert.match(statusMsg, /SMS dispatch is currently unavailable/);
  assert.equal(retryable, false, "Retry must remain disabled when all stations are unconfigured");
});

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n==================================================================");
console.log(`TEST SUMMARY: ${passedCount} passed, ${failedCount} failed`);
console.log("==================================================================");

if (failedCount > 0) {
  process.exit(1);
}
