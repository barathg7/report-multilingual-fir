// tests/sos_automatic_shuffled.test.mjs
// Stage 6.5: Automatic SOS Message + Shuffled Contact Assignment Test Suite
// Verifies all 10 mandatory criteria specified in Stage 6.5.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUTHORIZED_SOS_RECIPIENTS,
  isAuthorizedRecipient,
  maskPhoneNumber,
  getStationShuffledRecipients,
  getStationCategorizedRecipients,
  buildCanonicalSosMessage,
  hashString,
} from "../src/config/sosRecipients.js";

import {
  buildNativeSmsUri,
  buildMapsUrl,
} from "../src/lib/sosClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("==================================================================");
console.log("RUNNING STAGE 6.5 AUTOMATIC SOS & SHUFFLED CONTACTS TEST SUITE");
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
// CRITERION 1 — SOS message generated automatically
// ─────────────────────────────────────────────────────────────────────────────
runTest("CRITERION 1: SOS message is generated automatically with all required fields", () => {
  const location = { lat: 12.8907, lng: 79.3243, accuracy: 12 };
  const nearestStation = {
    station_name: "West Police Station",
    station_code: "TN-ARC-B0085",
  };
  const timestamp = "15/09/2026, 11:45:00 am";

  const message = buildCanonicalSosMessage({ location, nearestStation, timestamp });

  // Verify all specified sections
  assert.match(message, /^🚨 EMERGENCY SOS/);
  assert.match(message, /Immediate assistance requested\./);
  assert.match(message, /Time: 15\/09\/2026, 11:45:00 am/);
  assert.match(message, /Location:\nhttps:\/\/www\.google\.com\/maps\?q=12\.89070,79\.32430/);
  assert.match(message, /GPS accuracy:\n±12m/);
  assert.match(message, /Nearest police station:\nWest Police Station \(TN-ARC-B0085\)/);
  assert.match(message, /Emergency assistance is required\./);
  assert.match(message, /Call 112 for immediate emergency support\./);
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITERION 2 — No manual emergency-message input required
// ─────────────────────────────────────────────────────────────────────────────
runTest("CRITERION 2: No manual emergency-message input required (zero textarea/input in SOS flow)", () => {
  const componentPath = path.join(projectRoot, "src", "components", "kavalan", "EmergencySecurity.jsx");
  const content = fs.readFileSync(componentPath, "utf-8");

  // Verify there are no textarea or manual text input fields in the emergency security component
  assert.doesNotMatch(content, /<textarea/i, "EmergencySecurity must NOT contain any textarea for citizen typing");
  assert.doesNotMatch(content, /type=["']text["']/i, "EmergencySecurity must NOT contain text inputs for manual messaging");
  assert.doesNotMatch(content, /placeholder=["'][^"']*message/i, "No emergency message placeholder allowed");
  assert.match(content, /canonicalSosMsg/, "Canonical automatic message must be used directly");
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITERION 3 — Station-specific deterministic shuffle
// ─────────────────────────────────────────────────────────────────────────────
runTest("CRITERION 3: Station-specific deterministic shuffle generates a valid permutation of all 6 numbers", () => {
  const stationCode = "TN-ARC-B0085";
  const shuffled = getStationShuffledRecipients(stationCode);

  assert.equal(shuffled.length, 6, "Must contain exactly 6 numbers");
  assert.equal(new Set(shuffled).size, 6, "Must contain 6 distinct numbers");

  // Every number must belong to AUTHORIZED_SOS_RECIPIENTS
  for (const num of shuffled) {
    assert.ok(AUTHORIZED_SOS_RECIPIENTS.includes(num), `${num} must be an authorized number`);
  }

  // Permutation must contain all authorized numbers
  for (const authNum of AUTHORIZED_SOS_RECIPIENTS) {
    assert.ok(shuffled.includes(authNum), `Shuffled list must include ${authNum}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITERION 4 — Same station code always produces same six-number ordering
// ─────────────────────────────────────────────────────────────────────────────
runTest("CRITERION 4: Same station code always produces identical six-number ordering across runs", () => {
  const stations = ["TN-ARC-B0085", "TN-CHN-001", "TN-MDU-001", "TN-CBE-002", "TN-TRY-003"];

  for (const stn of stations) {
    const run1 = getStationShuffledRecipients(stn);
    const run2 = getStationShuffledRecipients(stn);
    const run3 = getStationShuffledRecipients(stn.toLowerCase()); // Case-insensitive stability

    assert.deepEqual(run1, run2, `Station ${stn} must be strictly repeatable`);
    assert.deepEqual(run1, run3, `Station ${stn} must normalize case consistently`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITERION 5 — Different station codes produce different orderings
// ─────────────────────────────────────────────────────────────────────────────
runTest("CRITERION 5: Different station codes produce different contact orderings", () => {
  const arc = getStationShuffledRecipients("TN-ARC-B0085");
  const chn = getStationShuffledRecipients("TN-CHN-001");
  const mdu = getStationShuffledRecipients("TN-MDU-001");

  assert.notDeepEqual(arc, chn, "TN-ARC-B0085 and TN-CHN-001 must have different orderings");
  assert.notDeepEqual(arc, mdu, "TN-ARC-B0085 and TN-MDU-001 must have different orderings");
  assert.notDeepEqual(chn, mdu, "TN-CHN-001 and TN-MDU-001 must have different orderings");
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITERION 6 — Only first three numbers are primary
// ─────────────────────────────────────────────────────────────────────────────
runTest("CRITERION 6: Exactly the first three numbers are designated as primary contacts", () => {
  const stations = ["TN-ARC-B0085", "TN-CHN-001", "TN-MDU-001"];

  for (const stn of stations) {
    const full = getStationShuffledRecipients(stn);
    const { primary, backup } = getStationCategorizedRecipients(stn);

    assert.equal(primary.length, 3, "Primary list must have exactly 3 numbers");
    assert.deepEqual(primary, full.slice(0, 3), "Primary must be the first three numbers of the station ordering");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITERION 7 — Remaining three numbers are backups
// ─────────────────────────────────────────────────────────────────────────────
runTest("CRITERION 7: Exactly the remaining three numbers are designated as backup contacts", () => {
  const stations = ["TN-ARC-B0085", "TN-CHN-001", "TN-MDU-001"];

  for (const stn of stations) {
    const full = getStationShuffledRecipients(stn);
    const { primary, backup } = getStationCategorizedRecipients(stn);

    assert.equal(backup.length, 3, "Backup list must have exactly 3 numbers");
    assert.deepEqual(backup, full.slice(3, 6), "Backup must be numbers 4-6 of the station ordering");

    // Primary and backup sets must be disjoint
    for (const b of backup) {
      assert.ok(!primary.includes(b), `Backup contact ${b} must not appear in primary list`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITERION 8 — sms: URL contains prefilled encoded SOS message
// ─────────────────────────────────────────────────────────────────────────────
runTest("CRITERION 8: sms: URL contains prefilled recipient and fully URL-encoded complete SOS message", () => {
  const location = { lat: 12.8907, lng: 79.3243, accuracy: 12 };
  const nearestStation = { station_name: "West Police Station", station_code: "TN-ARC-B0085" };
  const timestamp = "15/09/2026, 11:45:00 am";

  const message = buildCanonicalSosMessage({ location, nearestStation, timestamp });
  const recipient = AUTHORIZED_SOS_RECIPIENTS[0];
  const smsUri = buildNativeSmsUri(recipient, message);

  assert.ok(smsUri.startsWith(`sms:${recipient}?body=`), "Must start with sms:+91...?body=");
  assert.ok(!smsUri.includes(" "), "sms: URI must have zero raw unencoded spaces");

  // Validate that decoding reproduces the exact complete canonical message
  const encodedBody = smsUri.split("?body=")[1];
  const decodedBody = decodeURIComponent(encodedBody);
  assert.equal(decodedBody, message, "Decoded body must match the canonical SOS message character-for-character");
  assert.match(decodedBody, /🚨 EMERGENCY SOS/);
  assert.match(decodedBody, /Call 112 for immediate emergency support\./);
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITERION 9 — Arbitrary phone number injection is rejected
// ─────────────────────────────────────────────────────────────────────────────
runTest("CRITERION 9: Arbitrary phone number injection is strictly rejected by system", () => {
  const arbitraryNumbers = [
    "+919999999999",
    "+919876543210",
    "+14155552671",
    "9876543210",
    "+918428077015", // Off by 1 digit
    "javascript:alert(1)",
    "tel:112",
  ];

  for (const num of arbitraryNumbers) {
    assert.equal(isAuthorizedRecipient(num), false, `${num} must not be authorized`);
    assert.throws(
      () => buildNativeSmsUri(num, "Emergency test"),
      /Unauthorized SOS recipient/,
      `buildNativeSmsUri must throw for arbitrary recipient: ${num}`
    );
  }

  // Verify getStationShuffledRecipients cannot be polluted with arbitrary inputs
  const shuffled = getStationShuffledRecipients("EVIL-INPUT'; DROP TABLE sos_records;--");
  assert.equal(shuffled.length, 6);
  for (const num of shuffled) {
    assert.ok(isAuthorizedRecipient(num), "All shuffled outputs must remain strictly in authorized whitelist");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITERION 10 — UI never claims SMS delivery
// ─────────────────────────────────────────────────────────────────────────────
runTest("CRITERION 10: UI never claims SMS delivery (no 'SMS sent', 'SMS delivered', or 'Sent successfully')", () => {
  const componentPath = path.join(projectRoot, "src", "components", "kavalan", "EmergencySecurity.jsx");
  const content = fs.readFileSync(componentPath, "utf-8");

  // Deceptive delivery phrases must NEVER appear in UI
  assert.doesNotMatch(content, /["'`]\s*SMS sent\s*["'`]/i);
  assert.doesNotMatch(content, /["'`]\s*SMS delivered\s*["'`]/i);
  assert.doesNotMatch(content, /["'`]\s*Sent successfully\s*["'`]/i);
  assert.doesNotMatch(content, /["'`]\s*Message delivered\s*["'`]/i);
  assert.doesNotMatch(content, />\s*SMS sent\s*</i);
  assert.doesNotMatch(content, />\s*SMS delivered\s*</i);
  assert.doesNotMatch(content, />\s*Sent successfully\s*</i);

  // Truthful automated feedback text
  assert.match(content, /SOS SMS submitted to 3 emergency contacts/);
  assert.match(content, /AUTOMATIC SOS SMS/);
  assert.doesNotMatch(content, /Tap Send/);
  assert.doesNotMatch(content, /"Open SMS"/);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n==================================================================");
console.log(`STAGE 6.5 TEST SUMMARY: ${passedCount} passed, ${failedCount} failed`);
console.log("==================================================================");

if (failedCount > 0) {
  process.exit(1);
}
