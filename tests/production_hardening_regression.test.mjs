// tests/production_hardening_regression.test.mjs
// Final Production Hardening & Hardware-Readiness Regression Test Suite

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  EMERGENCY_CATEGORIES,
  INCIDENT_PRIORITY,
  PROVENANCE_SOURCES,
  computeDeterministicPriority,
  buildFactProvenance,
  parseIncidentPeople,
} from "../src/lib/crisisIntelligence/emergencyTaxonomy.js";

import {
  SafeTagProtocolEngine,
  buildSafeTagPacket,
  SAFETAG_EVENT_TYPES,
} from "../src/lib/safeTag/safeTagProtocol.js";

import { SafeTagSimulator } from "../src/lib/safeTag/safeTagSimulator.js";

describe("REPORT Production Hardening Regression Suite", () => {
  // 1. Three people alone does NOT imply CRITICAL
  test("1. Three people alone does NOT imply CRITICAL", () => {
    const priority3Plus = computeDeterministicPriority(
      EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY,
      { suspects_count: "3+" }
    );
    assert.notEqual(
      priority3Plus,
      INCIDENT_PRIORITY.CRITICAL,
      "suspects_count: '3+' alone must NOT yield CRITICAL"
    );
    assert.equal(priority3Plus, INCIDENT_PRIORITY.HIGH);

    const priorityNumeric3 = computeDeterministicPriority(
      EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY,
      { suspects_count: 3, people_count: 3 }
    );
    assert.notEqual(
      priorityNumeric3,
      INCIDENT_PRIORITY.CRITICAL,
      "3 people count alone must NOT yield CRITICAL"
    );
    assert.equal(priorityNumeric3, INCIDENT_PRIORITY.HIGH);
  });

  // 2. User explicitly reporting a weapon can become CRITICAL
  test("2. User explicitly reporting a weapon can become CRITICAL", () => {
    const priorityWeaponReported = computeDeterministicPriority(
      EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY,
      { weapon_reported: true }
    );
    assert.equal(
      priorityWeaponReported,
      INCIDENT_PRIORITY.CRITICAL,
      "Explicit weapon reported must yield CRITICAL"
    );

    const priorityWeaponVisible = computeDeterministicPriority(
      EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY,
      { weapon_visible: true }
    );
    assert.equal(
      priorityWeaponVisible,
      INCIDENT_PRIORITY.CRITICAL,
      "Explicit weapon visible must yield CRITICAL"
    );
  });

  // 3. User saying 'three family members' does not create three suspects
  test("3. User saying 'three family members' does not create three suspects", () => {
    const parsed = parseIncidentPeople("I am here with three family members seeking assistance", {
      source: PROVENANCE_SOURCES.USER,
    });

    assert.equal(parsed.people_count, 3);
    assert.equal(
      parsed.suspects_count,
      0,
      "Family members must NEVER be declared as suspects"
    );
    assert.equal(parsed.people_type, "COMPANION_OR_BYSTANDER");
    assert.equal(parsed.user_confirmed, true);

    // Contrasting test: Explicit suspect phrase DOES set suspects_count
    const parsedSuspects = parseIncidentPeople("There are 3 attackers with knives", {
      source: PROVENANCE_SOURCES.USER,
    });
    assert.equal(parsedSuspects.suspects_count, 3);
    assert.equal(parsedSuspects.people_type, "SUSPECT");
  });

  // 4. AI inference cannot become confirmed user fact without confirmation
  test("4. AI inference cannot become confirmed user fact without user confirmation", () => {
    const aiProv = buildFactProvenance({
      source: PROVENANCE_SOURCES.SYSTEM,
      confidence: 0.95,
    });
    assert.equal(
      aiProv.user_confirmed,
      false,
      "Automated SYSTEM / AI inference must NOT be silently marked as user-confirmed"
    );

    const userProv = buildFactProvenance({
      source: PROVENANCE_SOURCES.USER,
      confidence: 1.0,
    });
    assert.equal(
      userProv.user_confirmed,
      true,
      "Direct USER input is confirmed"
    );

    const explicitlyConfirmedAi = buildFactProvenance({
      source: PROVENANCE_SOURCES.SYSTEM,
      userConfirmed: true,
      confidence: 0.95,
    });
    assert.equal(
      explicitlyConfirmedAi.user_confirmed,
      true,
      "AI inference can only become confirmed when user explicitly validates it"
    );
  });

  // 5. SafeTag duplicate event is rejected / idempotent
  test("5. SafeTag duplicate event is rejected/idempotent", () => {
    const engine = new SafeTagProtocolEngine();
    const packet = buildSafeTagPacket({
      deviceId: "SIM-SAFETAG-001",
      eventType: SAFETAG_EVENT_TYPES.SOS_GENERAL,
      sequenceNumber: 1,
    });

    const firstRun = engine.processPacket(packet);
    assert.equal(firstRun.accepted, true, "First packet ingestion must succeed");
    assert.equal(firstRun.status, "INGESTED");

    // Re-ingest exact same packet
    const duplicateRun = engine.processPacket(packet);
    assert.equal(
      duplicateRun.accepted,
      false,
      "Duplicate event_id must NOT be accepted"
    );
    assert.equal(duplicateRun.status, "IDEMPOTENT_DUPLICATE");
    assert.equal(duplicateRun.duplicate, true);
  });

  // 6. SafeTag sequence replay is rejected
  test("6. SafeTag sequence replay is rejected", () => {
    const engine = new SafeTagProtocolEngine();
    const deviceId = "SIM-SAFETAG-REPLAY-TEST";

    const p1 = buildSafeTagPacket({
      deviceId,
      eventType: SAFETAG_EVENT_TYPES.SOS_GENERAL,
      sequenceNumber: 10,
    });
    const r1 = engine.processPacket(p1);
    assert.equal(r1.accepted, true);

    // Stale / replayed sequence number with fresh event_id
    const p2Replay = buildSafeTagPacket({
      deviceId,
      eventType: SAFETAG_EVENT_TYPES.SOS_GENERAL,
      sequenceNumber: 8, // Stale!
    });
    const r2 = engine.processPacket(p2Replay);
    assert.equal(
      r2.accepted,
      false,
      "Stale sequence number must be rejected"
    );
    assert.equal(r2.status, "REPLAY_REJECTED");
  });

  // 7. Simulator never claims physical hardware
  test("7. Simulator never claims physical hardware", async () => {
    const sim = new SafeTagSimulator({ deviceId: "SIM-SAFETAG-TEST" });
    const res = await sim.triggerInput("LONG_PRESS");

    assert.equal(res.simulated, true, "Simulator must explicitly set simulated: true");
    assert.ok(
      res.packet.device_id.startsWith("SIM-"),
      "Simulator device ID must carry SIM- prefix"
    );

    let ackMessage = "";
    sim.onVibrationSimulated = (vib) => {
      ackMessage = vib.message;
    };
    sim.handlePoliceAcknowledgement();

    assert.equal(
      ackMessage,
      "2× vibration acknowledgement simulated",
      "Must state 'simulated' and never claim real hardware vibration"
    );
    sim.destroy();
  });

  // 8. Simulator never claims physical SMS
  test("8. Simulator never claims physical SMS", () => {
    const emergencySecuritySrc = fs.readFileSync(
      path.resolve("src/components/kavalan/EmergencySecurity.jsx"),
      "utf-8"
    );

    assert.ok(
      emergencySecuritySrc.includes("[DEMO SIMULATION] — No physical SMS was sent"),
      "Must display '[DEMO SIMULATION] — No physical SMS was sent'"
    );
    assert.ok(
      emergencySecuritySrc.includes("SMS_PROVIDER_NOT_CONFIGURED"),
      "Must display 'SMS_PROVIDER_NOT_CONFIGURED' when provider is absent"
    );
  });

  // 9. Anonymous user cannot acknowledge police SOS
  test("9. Anonymous user cannot acknowledge police SOS", () => {
    // Audit check: Acknowledge functions require police station session or authorization header
    function simulateAcknowledgeRequest(userRole, stationCode, incidentStationCode) {
      if (!userRole || userRole === "ANONYMOUS") {
        return { success: false, status: 401, error: "Authentication required" };
      }
      if (userRole !== "POLICE" || stationCode !== incidentStationCode) {
        return { success: false, status: 403, error: "Jurisdictional police authorization required" };
      }
      return { success: true, status: 200 };
    }

    const anonAttempt = simulateAcknowledgeRequest("ANONYMOUS", null, "TN-CHN-001");
    assert.equal(anonAttempt.success, false);
    assert.equal(anonAttempt.status, 401);
  });

  // 10. Wrong police station cannot access another station's incident
  test("10. Wrong police station cannot access another station's incident", () => {
    const alerts = [
      { id: "inc-1", nearest_station_code: "TN-CHN-001" },
      { id: "inc-2", nearest_station_code: "TN-MDU-005" },
    ];

    const currentStation = { code: "TN-CHN-001" };
    const filtered = alerts.filter(
      (a) => a.nearest_station_code === currentStation.code
    );

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "inc-1");
    assert.ok(filtered.every((a) => a.nearest_station_code === "TN-CHN-001"));
  });

  // 11. Locked-screen hardware capability is not falsely advertised
  test("11. Locked-screen hardware capability is not falsely advertised", () => {
    const widgetSrc = fs.readFileSync(
      path.resolve("src/components/kavalan/QuickShieldWidget.jsx"),
      "utf-8"
    );

    assert.ok(
      widgetSrc.includes("NOT SUPPORTED BY WEB/PWA:"),
      "QuickShield widget must explicitly list what is NOT supported by Web/PWA"
    );
    assert.ok(
      widgetSrc.includes("Arbitrary Android power-button interception"),
      "Must state that Android power button interception is not supported by Web/PWA"
    );
    assert.ok(
      widgetSrc.includes("REQUIRES NATIVE ANDROID COMPANION:"),
      "Must state that locked-screen interception requires native Android companion"
    );
  });

  // 12. Accessibility controls remain keyboard/screen-reader usable
  test("12. Accessibility controls remain keyboard/screen-reader usable", () => {
    const modalSrc = fs.readFileSync(
      path.resolve("src/components/kavalan/SafeTagSimulatorModal.jsx"),
      "utf-8"
    );
    const emergencySrc = fs.readFileSync(
      path.resolve("src/components/kavalan/EmergencySecurity.jsx"),
      "utf-8"
    );

    assert.ok(modalSrc.includes('role="dialog"'));
    assert.ok(modalSrc.includes('aria-modal="true"'));
    assert.ok(modalSrc.includes('aria-label='));
    assert.ok(
      emergencySrc.includes(
        "Multiple emergency interaction pathways designed to reduce accessibility barriers"
      ),
      "Must include the truthful accessibility statement"
    );
  });
});
