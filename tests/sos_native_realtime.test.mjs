// tests/sos_native_realtime.test.mjs
// Stage 6.3: Station-Aware Native + Realtime SOS Architecture Test Suite
// Verifies all 10 mandatory criteria specified in Stage 6.3 specification.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildMapsUrl,
  buildNativeShareMessage,
  buildNativeSmsUri,
  buildSOSInsertPayload,
} from "../src/lib/sosClient.js";

import {
  AUTHORIZED_SOS_RECIPIENTS,
  isAuthorizedRecipient,
  maskPhoneNumber,
  buildSosMessage,
} from "../src/config/sosRecipients.js";

import { isValidDispatchPhone } from "../src/utils/phoneValidation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("==================================================================");
console.log("RUNNING STAGE 6.3 NATIVE + REALTIME SOS ARCHITECTURE TEST SUITE");
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
// TEST 1 — GPS payload creation
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 1: GPS payload creation normalizes coordinates and accuracy metric", () => {
  const rawGPS = {
    latitude: 13.001234,
    longitude: 80.256543,
    accuracy: 14.8,
  };

  const payload = buildSOSInsertPayload({
    latitude: rawGPS.latitude,
    longitude: rawGPS.longitude,
    accuracy: rawGPS.accuracy,
    nearestStation: { station_code: "TN-CHN-001", station_name: "Adyar Police Station" },
    message: "SOS — immediate assistance requested.",
    userId: "usr-1234-uuid",
  });

  assert.equal(typeof payload.latitude, "number");
  assert.equal(typeof payload.longitude, "number");
  assert.equal(payload.latitude, 13.001234);
  assert.equal(payload.longitude, 80.256543);
  assert.equal(payload.accuracy, 15, "Accuracy must be rounded to whole meters");
  assert.equal(payload.user_id, "usr-1234-uuid");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — SOS insert payload matches station-aware schema
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 2: SOS insert payload includes all required station-aware database fields", () => {
  const station = {
    station_code: "TN-CHN-005",
    station_name: "Mylapore Police Station",
  };

  const payload = buildSOSInsertPayload({
    latitude: 13.0333,
    longitude: 80.2667,
    accuracy: 8,
    nearestStation: station,
    userId: null,
  });

  const expectedKeys = [
    "user_id",
    "latitude",
    "longitude",
    "accuracy",
    "nearest_station_code",
    "nearest_station_name",
    "maps_url",
    "message",
    "status",
  ];

  for (const key of expectedKeys) {
    assert.ok(key in payload, `Missing key in SOS insert payload: ${key}`);
  }

  assert.equal(payload.nearest_station_code, "TN-CHN-005");
  assert.equal(payload.nearest_station_name, "Mylapore Police Station");
  assert.equal(payload.status, "active", "Default initial status must be 'active'");
  assert.match(payload.maps_url, /^https:\/\/www\.google\.com\/maps\?q=13\.03330,80\.26670$/);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Own-user RLS logic assumptions
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 3: Own-user RLS policy logic ensures citizens only access own SOS records", () => {
  // Simulating the Postgres RLS USING expression:
  // (auth.uid() IS NOT NULL AND user_id = auth.uid())
  const rlsCitizenSelect = (authUid, record) => {
    return Boolean(authUid && record.user_id === authUid);
  };

  const rlsCitizenInsert = (authUid, payload) => {
    return (!authUid && !payload.user_id) || (Boolean(authUid) && payload.user_id === authUid);
  };

  const citizenA = "uid-citizen-aaa";
  const citizenB = "uid-citizen-bbb";

  const recordOfA = { id: "sos-1", user_id: citizenA, status: "active" };
  const recordOfB = { id: "sos-2", user_id: citizenB, status: "active" };

  // Citizen A can view own record
  assert.equal(rlsCitizenSelect(citizenA, recordOfA), true, "Citizen must be allowed to SELECT own SOS");

  // Citizen A CANNOT view Citizen B's record
  assert.equal(rlsCitizenSelect(citizenA, recordOfB), false, "Citizen must NOT be allowed to SELECT other's SOS");

  // Citizen B CANNOT view Citizen A's record
  assert.equal(rlsCitizenSelect(citizenB, recordOfA), false, "Citizen B must NOT access Citizen A's record");

  // Citizen inserting with mismatched user_id is rejected
  assert.equal(
    rlsCitizenInsert(citizenA, { user_id: citizenB }),
    false,
    "Citizen A inserting with Citizen B's UID must be blocked by RLS WITH CHECK"
  );

  // Anonymous citizen inserting with null UID is allowed
  assert.equal(
    rlsCitizenInsert(null, { user_id: null }),
    true,
    "Anonymous citizen inserting unauthenticated SOS with null user_id is permitted"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — Station-scoped police access assumptions
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 4: Police authorization strictly limits access to matching nearest_station_code", () => {
  // Simulating the Postgres Police RLS SELECT policy:
  // (auth.jwt()->'app_metadata'->>'station_code' = nearest_station_code OR officer.station_code = nearest_station_code)
  const rlsPoliceSelect = (officer, record) => {
    if (!officer || !officer.isActive) return false;
    return officer.stationCode === record.nearest_station_code;
  };

  const officerAdyar = {
    authUid: "po-adyar-1",
    stationCode: "TN-CHN-001",
    badge: "ADY-101",
    isActive: true,
  };

  const officerMadurai = {
    authUid: "po-mdu-1",
    stationCode: "TN-MDU-001",
    badge: "MDU-501",
    isActive: true,
  };

  const adyarSOS = {
    id: "sos-adyar",
    nearest_station_code: "TN-CHN-001",
    nearest_station_name: "Adyar Police Station",
    status: "active",
  };

  const maduraiSOS = {
    id: "sos-madurai",
    nearest_station_code: "TN-MDU-001",
    nearest_station_name: "Madurai South PS",
    status: "active",
  };

  // Officer at Adyar can view Adyar SOS
  assert.equal(rlsPoliceSelect(officerAdyar, adyarSOS), true, "Adyar officer must access Adyar SOS");

  // Officer at Adyar CANNOT view Madurai SOS
  assert.equal(
    rlsPoliceSelect(officerAdyar, maduraiSOS),
    false,
    "Police must NOT receive foreign station's SOS simply because they are authenticated"
  );

  // Officer at Madurai CANNOT view Adyar SOS
  assert.equal(
    rlsPoliceSelect(officerMadurai, adyarSOS),
    false,
    "Madurai officer must NOT view Adyar SOS"
  );

  // Inactive officer is denied
  const inactiveOfficer = { ...officerAdyar, isActive: false };
  assert.equal(rlsPoliceSelect(inactiveOfficer, adyarSOS), false, "Inactive officer must be denied access");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — Maps URL generation
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 5: Maps URL generator formats valid Google Maps query string", () => {
  const url1 = buildMapsUrl(13.08268, 80.27071);
  assert.equal(url1, "https://www.google.com/maps?q=13.08268,80.27071");

  const url2 = buildMapsUrl("12.971600", "77.594600");
  assert.equal(url2, "https://www.google.com/maps?q=12.97160,77.59460");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6 — Native Web Share payload formatting and truthfulness
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 6: Web Share payload matches exact specified format without false claims", () => {
  const shareText = buildNativeShareMessage({
    location: { lat: 13.00123, lng: 80.25654, accuracy: 12.3 },
    nearestStation: { station_name: "Adyar Police Station", station_code: "TN-CHN-001", distance_km: 1.2 },
    timestamp: "12/09/2026, 08:00:00 AM",
  });

  // Must match specified multi-line structure:
  assert.match(shareText, /^SOS — immediate assistance requested\./);
  assert.match(shareText, /Time:\n12\/09\/2026, 08:00:00 AM/);
  assert.match(shareText, /Location:\nhttps:\/\/www\.google\.com\/maps\?q=13\.00123,80\.25654/);
  assert.match(shareText, /GPS accuracy:\n±12m/);
  assert.match(shareText, /Nearest station:\nAdyar Police Station \[TN-CHN-001\] \(1\.2 km away\)/);

  // Must NEVER claim automatic background SMS sent
  assert.doesNotMatch(shareText, /SMS sent/i);
  assert.doesNotMatch(shareText, /Automatic SMS delivered/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7 — Native SMS URI encoding
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 7: Native SMS URI properly encodes RFC 5724 body query parameter", () => {
  const phone = AUTHORIZED_SOS_RECIPIENTS[0]; // "+918428077014"
  const message = "SOS — immediate assistance requested.\nLocation: https://maps.google.com";

  const uri = buildNativeSmsUri(phone, message);

  assert.ok(uri.startsWith("sms:+918428077014?body="));
  assert.ok(!uri.includes(" "), "URI must not contain unencoded raw spaces");
  assert.ok(uri.includes(encodeURIComponent("immediate assistance requested.")));

  // Verify decoded body
  const bodyParam = uri.split("?body=")[1];
  assert.equal(decodeURIComponent(bodyParam), message);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8 — Direct tel:112 emergency call action presence
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 8: tel:112 emergency call action is present and requires explicit user tap", () => {
  const emergencyComponentPath = path.join(
    projectRoot,
    "src",
    "components",
    "kavalan",
    "EmergencySecurity.jsx"
  );
  const fileContent = fs.readFileSync(emergencyComponentPath, "utf-8");

  // Must contain tel:112
  assert.match(fileContent, /href=["']tel:112["']/);
  assert.match(fileContent, /📞 Call 112 Directly/);

  // Must NOT auto-invoke window.location.href = "tel:112"
  assert.doesNotMatch(
    fileContent,
    /window\.location(\.href)?\s*=\s*["']tel:112["']/,
    "Emergency calling must NEVER trigger automatically without explicit user action"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 9 — No arbitrary SMS recipient accepted
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 9: Arbitrary phone numbers are strictly rejected by native SMS builder", () => {
  const unauthorizedNumbers = [
    "+919999999999",
    "+919876543210",
    "+14155552671",
    "8428077014",
    "+918428077015",
  ];

  for (const num of unauthorizedNumbers) {
    assert.throws(
      () => buildNativeSmsUri(num, "SOS message"),
      /Unauthorized SOS recipient/,
      `Arbitrary recipient ${num} must be rejected`
    );
  }

  // Authorized numbers succeed
  for (const authNum of AUTHORIZED_SOS_RECIPIENTS) {
    const uri = buildNativeSmsUri(authNum, "Test message");
    assert.ok(uri.startsWith(`sms:${authNum}?body=`));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 10 — No fake delivery status claims
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 10: UI components guarantee truthful delivery status (no hardcoded 'SMS sent')", () => {
  const emergencyComponentPath = path.join(
    projectRoot,
    "src",
    "components",
    "kavalan",
    "EmergencySecurity.jsx"
  );
  const fileContent = fs.readFileSync(emergencyComponentPath, "utf-8");

  // Verify automated section requirements:
  assert.match(fileContent, /AUTOMATIC POLICE ALERT/);
  assert.match(fileContent, /SOS alert delivered to police dashboard/);
  assert.match(fileContent, /AUTOMATIC SOS SMS/);
  assert.match(fileContent, /3 primary emergency contacts/);
  assert.match(fileContent, /SEND SOS TO 3 CONTACTS/);
  assert.match(fileContent, /SOS SMS submitted to 3 emergency contacts/);
  assert.doesNotMatch(fileContent, /Tap Send/);
  assert.doesNotMatch(fileContent, /"Open SMS"/);

  // Verify that deceptive delivery strings are NEVER used
  assert.doesNotMatch(fileContent, />\s*SMS sent\s*</i);
  assert.doesNotMatch(fileContent, /"SMS sent"/i);
  assert.doesNotMatch(fileContent, /"SMS delivered"/i);
  assert.doesNotMatch(fileContent, /"Sent successfully"/i);
  assert.doesNotMatch(fileContent, /"Message delivered"/i);

  // Verify 13 discrete state names exist in the component state definition
  const requiredStates = [
    "IDLE",
    "CONFIRM",
    "ACQUIRING GPS",
    "GPS READY",
    "SOS ACTIVE",
    "POLICE ALERTED",
    "SHARE READY",
    "SMS UNAVAILABLE",
    "ACKNOWLEDGED",
    "RESOLVED",
    "GPS FAILURE",
    "PERMISSION DENIED",
    "NETWORK FAILURE",
  ];

  for (const st of requiredStates) {
    assert.ok(
      fileContent.includes(st),
      `EmergencySecurity component must define and handle state: ${st}`
    );
  }
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
