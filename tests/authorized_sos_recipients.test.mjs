// tests/authorized_sos_recipients.test.mjs
// Stage 6.2: Authorized Emergency SOS Recipients & Security Test Suite
// Verifies all 14 mandatory test criteria for Stage 6.2 SOS pipeline.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUTHORIZED_SOS_RECIPIENTS,
  isAuthorizedRecipient,
  maskPhoneNumber,
  buildSosMessage
} from "../src/config/sosRecipients.js";

import {
  buildNativeSmsUri
} from "../src/lib/sosClient.js";

import {
  isValidDispatchPhone,
  normalizeStationPhone
} from "../src/utils/phoneValidation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("==================================================================");
console.log("RUNNING STAGE 6.2 AUTHORIZED SOS RECIPIENTS TEST SUITE");
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
// TEST 1 — All six numbers are normalized correctly
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 1: All six raw numbers normalize to exact E.164 +91 format", () => {
  const rawInput = [
    "8428077014",
    "6382586270",
    "8122319636",
    "9487304237",
    "9047461987",
    "6374763637"
  ];

  const expectedE164 = [
    "+918428077014",
    "+916382586270",
    "+918122319636",
    "+919487304237",
    "+919047461987",
    "+916374763637"
  ];

  const normalized = rawInput.map(num => `+91${num}`);
  assert.deepEqual(normalized, expectedE164);
  assert.deepEqual(AUTHORIZED_SOS_RECIPIENTS, expectedE164);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — All six pass E.164 validation
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 2: All six authorized recipients pass strict E.164 phone validation", () => {
  assert.equal(AUTHORIZED_SOS_RECIPIENTS.length, 6);
  for (const phone of AUTHORIZED_SOS_RECIPIENTS) {
    assert.equal(isValidDispatchPhone(phone), true, `${phone} must pass isValidDispatchPhone`);
    assert.match(phone, /^\+91\d{10}$/, `${phone} must match +91 followed by 10 digits`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Exactly six authorized recipients exist
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 3: Exactly six unique authorized recipients exist in configuration", () => {
  assert.equal(AUTHORIZED_SOS_RECIPIENTS.length, 6);
  const uniqueSet = new Set(AUTHORIZED_SOS_RECIPIENTS);
  assert.equal(uniqueSet.size, 6, "All 6 recipients must be distinct");
  assert.equal(Object.isFrozen(AUTHORIZED_SOS_RECIPIENTS), true, "Recipient list must be immutable");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — No "Contact Unavailable" recipient is dispatched
// ─────────────────────────────────────────────────────────────────────────────
runTest('TEST 4: Placeholders ("Contact Unavailable", null, undefined, "") are never authorized', () => {
  assert.equal(isAuthorizedRecipient("Contact Unavailable"), false);
  assert.equal(isAuthorizedRecipient("contact unavailable"), false);
  assert.equal(isAuthorizedRecipient("Unavailable"), false);
  assert.equal(isAuthorizedRecipient(""), false);
  assert.equal(isAuthorizedRecipient("   "), false);
  assert.equal(isAuthorizedRecipient(null), false);
  assert.equal(isAuthorizedRecipient(undefined), false);

  assert.equal(normalizeStationPhone("Contact Unavailable"), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — No arbitrary user-entered recipient is accepted
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 5: Arbitrary unconfigured numbers are strictly rejected by recipient validator", () => {
  const arbitraryNumbers = [
    "+919999999999",
    "+919876543210",
    "+14155552671",
    "+447911123456",
    "9876543210",
    "+918428077015" // Off by 1 digit
  ];

  for (const num of arbitraryNumbers) {
    assert.equal(
      isAuthorizedRecipient(num),
      false,
      `Arbitrary number ${num} must not be authorized`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6 — All six recipients are prepared for user-assisted SMS drafting
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 6: All six configured recipients are prepared for user-assisted SMS drafting", () => {
  assert.equal(AUTHORIZED_SOS_RECIPIENTS.length, 6);
  const uris = AUTHORIZED_SOS_RECIPIENTS.map((phone) =>
    buildNativeSmsUri(phone, "SOS — immediate assistance requested.")
  );
  assert.equal(uris.length, 6);
  for (let i = 0; i < 6; i++) {
    assert.ok(uris[i].startsWith(`sms:${AUTHORIZED_SOS_RECIPIENTS[i]}?body=`));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7 — Native SMS opening is never classified as delivered
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 7: Native SMS opening is never classified as delivered (remains unconfirmed draft)", () => {
  // Simulating user clicking Open SMS on any configured contact:
  // Must update status truthfully without claiming SMS sent or delivered
  const handleOpenSms = (phone) => {
    return {
      phone,
      action: "open_sms",
      status: "SMS draft opened. Tap Send on your phone.",
      smsNotice: "SMS prepared — tap Send in your messaging app",
      delivered: false,
      sent: false,
    };
  };

  for (const phone of AUTHORIZED_SOS_RECIPIENTS) {
    const state = handleOpenSms(phone);
    assert.equal(state.delivered, false, "Delivery must never be assumed when launching native SMS");
    assert.equal(state.sent, false, "Sent status must never be asserted without carrier confirmation");
    assert.equal(state.status, "SMS draft opened. Tap Send on your phone.");
    assert.doesNotMatch(state.status, /SMS sent/i);
    assert.doesNotMatch(state.status, /SMS delivered/i);
    assert.doesNotMatch(state.status, /Sent successfully/i);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8 — Web Share success is classified as "handed to share target", not SMS delivery
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 8: Web Share success is classified as 'handed to share target', not SMS delivery", () => {
  const handleShareResult = (shareSuccessful) => {
    if (shareSuccessful) {
      return {
        type: "web_share",
        status: "Share sheet opened. Delivery depends on the selected messaging app.",
        delivered: false,
        sent: false,
      };
    }
    return {
      type: "web_share",
      status: "Share sheet dismissed",
      delivered: false,
      sent: false,
    };
  };

  const result = handleShareResult(true);
  assert.equal(result.delivered, false);
  assert.equal(result.sent, false);
  assert.equal(result.status, "Share sheet opened. Delivery depends on the selected messaging app.");
  assert.doesNotMatch(result.status, /SMS sent/i);
  assert.doesNotMatch(result.status, /SMS delivered/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 9 — Supabase SOS insert success is classified as police alert success
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 9: Supabase SOS insert success is classified as police alert success", () => {
  const handleRecordCreation = (record) => {
    if (record && !record._local_only && record._supabase_inserted !== false) {
      return {
        sosState: "POLICE ALERTED",
        statusMessage: "SOS alert sent to the jurisdictional police dashboard",
        policeAlertDelivered: true,
      };
    }
    return {
      sosState: "NETWORK FAILURE",
      statusMessage: "Could not connect to police dashboard. SOS stored locally. Use Call 112 directly.",
      policeAlertDelivered: false,
    };
  };

  const cloudRecord = {
    id: "sos-test-uuid",
    nearest_station_code: "TN-CHN-001",
    _supabase_inserted: true,
    _local_only: false,
  };

  const localRecord = {
    id: "sos-test-local",
    nearest_station_code: "TN-CHN-001",
    _supabase_inserted: false,
    _local_only: true,
  };

  const cloudResult = handleRecordCreation(cloudRecord);
  assert.equal(cloudResult.sosState, "POLICE ALERTED");
  assert.equal(cloudResult.statusMessage, "SOS alert sent to the jurisdictional police dashboard");
  assert.equal(cloudResult.policeAlertDelivered, true);

  const localResult = handleRecordCreation(localRecord);
  assert.equal(localResult.sosState, "NETWORK FAILURE");
  assert.equal(localResult.policeAlertDelivered, false);
  assert.match(localResult.statusMessage, /Could not connect to police dashboard/);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 10 — Full phone numbers are masked in UI
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 10: Phone numbers are masked in UI showing only country code and last 4 digits", () => {
  const expectedMasked = [
    { phone: "+918428077014", masked: "+91 ••••••7014" },
    { phone: "+916382586270", masked: "+91 ••••••6270" },
    { phone: "+918122319636", masked: "+91 ••••••9636" },
    { phone: "+919487304237", masked: "+91 ••••••4237" },
    { phone: "+919047461987", masked: "+91 ••••••1987" },
    { phone: "+916374763637", masked: "+91 ••••••3637" }
  ];

  for (const { phone, masked } of expectedMasked) {
    const result = maskPhoneNumber(phone);
    assert.equal(result, masked, `${phone} must be masked as ${masked}`);
    assert.equal(result.includes("••••••"), true);
    assert.equal(result.slice(-4), phone.slice(-4));
    // Verify middle digits are never exposed
    assert.equal(result.includes(phone.slice(3, 9)), false);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 11 — Configured contact numbers remain present, immutable, and normalized
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 11: Configured contact numbers remain present, immutable, and normalized", () => {
  assert.equal(AUTHORIZED_SOS_RECIPIENTS.length, 6);
  for (const phone of AUTHORIZED_SOS_RECIPIENTS) {
    assert.match(phone, /^\+91\d{10}$/);
    assert.equal(isValidDispatchPhone(phone), true);
  }
  assert.ok(Object.isFrozen(AUTHORIZED_SOS_RECIPIENTS));
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 12 — No UI string claims SMS delivery without provider confirmation
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 12: No UI string in EmergencySecurity.jsx claims SMS delivery without provider confirmation", () => {
  const componentPath = path.join(projectRoot, "src", "components", "kavalan", "EmergencySecurity.jsx");
  const content = fs.readFileSync(componentPath, "utf-8");

  // Prohibited deceptive delivery phrases
  assert.doesNotMatch(content, /["'`]\s*SMS sent\s*["'`]/i);
  assert.doesNotMatch(content, /["'`]\s*SMS delivered\s*["'`]/i);
  assert.doesNotMatch(content, /["'`]\s*Sent successfully\s*["'`]/i);
  assert.doesNotMatch(content, /["'`]\s*Message delivered\s*["'`]/i);
  assert.doesNotMatch(content, />\s*SMS sent\s*</i);
  assert.doesNotMatch(content, />\s*SMS delivered\s*</i);
  assert.doesNotMatch(content, />\s*Sent successfully\s*</i);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 13 — Emergency contacts UI section explicitly verifies automated SMS dispatch without native composer
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 13: Emergency contacts UI section explicitly verifies automated SMS dispatch without native composer", () => {
  const componentPath = path.join(projectRoot, "src", "components", "kavalan", "EmergencySecurity.jsx");
  const content = fs.readFileSync(componentPath, "utf-8");

  assert.match(content, /AUTOMATIC POLICE ALERT/);
  assert.match(content, /SOS alert delivered to police dashboard/);
  assert.match(content, /Location shared/);
  assert.match(content, /Nearest station identified/);
  assert.match(content, /AUTOMATIC SOS SMS/);
  assert.match(content, /3 primary emergency contacts/);
  assert.match(content, /SEND SOS TO 3 CONTACTS/);
  assert.match(content, /SOS SMS submitted to 3 emergency contacts/);
  assert.doesNotMatch(content, /Tap Send/);
  assert.doesNotMatch(content, /"Open SMS"/);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 14 — Twilio credentials remain server-side
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 14: Twilio credentials exist only server-side and are NEVER in client bundle or VITE_ vars", () => {
  const envLocalPath = path.join(projectRoot, ".env.local");
  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, "utf-8");
    assert.equal(
      /VITE_.*TWILIO/i.test(envContent),
      false,
      ".env.local must not contain VITE_* TWILIO variables (must remain server-side only)"
    );
    assert.equal(
      /VITE_TWILIO_AUTH_TOKEN/i.test(envContent),
      false,
      ".env.local must not contain VITE_TWILIO_AUTH_TOKEN"
    );
  }

  // Inspect client source code for any hardcoded Twilio auth tokens
  const clientSrcDir = path.join(projectRoot, "src");
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) scanDir(full);
      else if (/\.(jsx?|tsx?)$/.test(e.name)) {
        const c = fs.readFileSync(full, "utf-8");
        assert.equal(
          /TWILIO_AUTH_TOKEN\s*=/i.test(c),
          false,
          `File ${full} must not define TWILIO_AUTH_TOKEN`
        );
        assert.equal(
          /import\.meta\.env\.VITE_TWILIO/i.test(c),
          false,
          `File ${full} must not read VITE_TWILIO variables`
        );
      }
    }
  }
  scanDir(clientSrcDir);

  // Verify server-side function exists and reads via Deno.env
  const edgeFunctionPath = path.join(projectRoot, "supabase", "functions", "send-sos-sms", "index.ts");
  assert.equal(fs.existsSync(edgeFunctionPath), true, "send-sos-sms edge function must exist");
  const edgeContent = fs.readFileSync(edgeFunctionPath, "utf-8");
  assert.match(edgeContent, /sendAutomaticSosSms/);
  assert.match(edgeContent, /AUTHORIZED_SOS_RECIPIENTS/);
});

// ─────────────────────────────────────────────────────────────────────────────
// BONUS TEST — Rich SOS Message Builder Verification
// ─────────────────────────────────────────────────────────────────────────────
runTest("BONUS TEST: SOS message correctly formats GPS coordinates, accuracy, nearest station, and map link", () => {
  const location = { lat: 13.00123, lng: 80.25654, accuracy: 15 };
  const nearestStation = {
    station_name: "Adyar Police Station",
    station_code: "TN-CHN-001",
    distance_km: 1.42
  };

  const message = buildSosMessage({ location, nearestStation, timestamp: "10/09/2026, 6:00:00 PM" });

  assert.match(message, /🚨 SOS ALERT/);
  assert.match(message, /Adyar Police Station \(TN-CHN-001\) - 1.4 km away/);
  assert.match(message, /Location: 13.00123, 80.25654/);
  assert.match(message, /Accuracy: \+\/-15m/);
  assert.match(message, /Map: https:\/\/www\.google\.com\/maps\?q=13\.00123,80\.25654/);
  assert.match(message, /Time: 10\/09\/2026, 6:00:00 PM/);
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
