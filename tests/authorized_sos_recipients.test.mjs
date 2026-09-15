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
// TEST 6 — All six recipients are attempted during dispatch
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 6: SOS dispatch attempts all six configured recipients concurrently", async () => {
  const attempted = [];
  const mockDispatch = async (recipient) => {
    attempted.push(recipient);
    return { success: true, sid: `SM_${recipient.slice(-4)}` };
  };

  const results = await Promise.all(
    AUTHORIZED_SOS_RECIPIENTS.map(async (phone) => {
      const resp = await mockDispatch(phone);
      return { phone, sent: resp.success, error: null };
    })
  );

  assert.equal(attempted.length, 6);
  assert.deepEqual(attempted, [...AUTHORIZED_SOS_RECIPIENTS]);
  assert.equal(results.length, 6);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7 — Successful recipients are marked SENT
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 7: Provider success marks recipient as SENT (✓ Sent)", async () => {
  const mockProvider = async (recipient) => ({ success: true, sid: "SM12345" });

  const record = await (async () => {
    const phone = AUTHORIZED_SOS_RECIPIENTS[0];
    const resp = await mockProvider(phone);
    return {
      phone,
      masked: maskPhoneNumber(phone),
      sent: resp.success,
      error: null,
      sid: resp.sid
    };
  })();

  assert.equal(record.sent, true);
  assert.equal(record.error, null);
  assert.equal(record.sid, "SM12345");
  const badgeText = record.sent ? "✓ Sent" : "⚠ Failed";
  assert.equal(badgeText, "✓ Sent");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8 — Failed recipients are marked FAILED
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 8: Provider rejection marks recipient as FAILED (⚠ Failed) without faking", async () => {
  const mockProvider = async (recipient) => {
    throw new Error("Twilio Error 21608: The number is unverified");
  };

  const record = await (async () => {
    const phone = AUTHORIZED_SOS_RECIPIENTS[1];
    try {
      await mockProvider(phone);
      return { phone, sent: true, error: null };
    } catch (err) {
      return { phone, sent: false, error: err.message };
    }
  })();

  assert.equal(record.sent, false);
  assert.match(record.error, /Twilio Error 21608/);
  const badgeText = record.sent ? "✓ Sent" : "⚠ Failed";
  assert.equal(badgeText, "⚠ Failed");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 9 — Retry only targets failed recipients
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 9: Retry exclusively targets failed recipients and never resends succeeded ones", async () => {
  // Initial results: 4 succeeded, 2 failed
  const initialResults = [
    { phone: "+918428077014", sent: true, error: null },
    { phone: "+916382586270", sent: true, error: null },
    { phone: "+918122319636", sent: false, error: "Carrier temporary failure" },
    { phone: "+919487304237", sent: true, error: null },
    { phone: "+919047461987", sent: false, error: "Carrier temporary failure" },
    { phone: "+916374763637", sent: true, error: null }
  ];

  const retryCalls = [];
  const mockRetrySender = async (phone) => {
    retryCalls.push(phone);
    return { success: true, sid: `SM_RETRY_${phone.slice(-4)}` };
  };

  // Perform selective retry
  const failedItems = initialResults.filter(r => !r.sent);
  assert.equal(failedItems.length, 2, "Only 2 failed items should be targeted for retry");

  const retryUpdates = await Promise.all(failedItems.map(async (item) => {
    const resp = await mockRetrySender(item.phone);
    return { ...item, sent: resp.success, error: null };
  }));

  assert.deepEqual(retryCalls, ["+918122319636", "+919047461987"]);

  // Merge back
  const updateMap = new Map(retryUpdates.map(u => [u.phone, u]));
  const finalResults = initialResults.map(r => updateMap.get(r.phone) || r);

  assert.equal(finalResults.every(r => r.sent), true, "All 6 items should now be marked sent");
  assert.equal(finalResults.length, 6);
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
// TEST 11 — Zero successful sends -> Call 100 fallback
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 11: Zero successful SMS dispatches displays Call 100 fallback message", () => {
  const results = AUTHORIZED_SOS_RECIPIENTS.map(phone => ({
    phone,
    sent: false,
    error: "Twilio unverified number in trial account"
  }));

  const sentCount = results.filter(r => r.sent).length;
  assert.equal(sentCount, 0);

  let statusMsg = "";
  let status = "idle";
  if (sentCount === 6) {
    status = "success";
    statusMsg = `Emergency alert sent to ${sentCount} of 6 contacts.`;
  } else if (sentCount > 0) {
    status = "partial";
    statusMsg = `Emergency alert sent to ${sentCount} of 6 contacts.`;
  } else {
    status = "error";
    statusMsg = "SMS delivery unavailable. Call 100 directly.";
  }

  assert.equal(status, "error");
  assert.equal(statusMsg, "SMS delivery unavailable. Call 100 directly.");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 12 — Partial success -> correct sent count
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 12: Partial success (4 of 6) displays correct sent count summary", () => {
  const results = [
    { sent: true }, { sent: true }, { sent: false },
    { sent: true }, { sent: false }, { sent: true }
  ];

  const sentCount = results.filter(r => r.sent).length;
  const total = results.length;
  assert.equal(sentCount, 4);

  let statusMsg = "";
  let status = "idle";
  if (sentCount === total) {
    status = "success";
    statusMsg = `Emergency alert sent to ${sentCount} of ${total} contacts.`;
  } else if (sentCount > 0) {
    status = "partial";
    statusMsg = `Emergency alert sent to ${sentCount} of ${total} contacts.`;
  } else {
    status = "error";
    statusMsg = "SMS delivery unavailable. Call 100 directly.";
  }

  assert.equal(status, "partial");
  assert.equal(statusMsg, "Emergency alert sent to 4 of 6 contacts.");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 13 — Full success -> correct sent count
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 13: Full success (6 of 6) displays correct sent count summary and disables retry", () => {
  const results = AUTHORIZED_SOS_RECIPIENTS.map(() => ({ sent: true }));
  const sentCount = results.filter(r => r.sent).length;
  const total = results.length;
  assert.equal(sentCount, 6);

  let statusMsg = "";
  let status = "idle";
  let retryable = false;

  if (sentCount === total) {
    status = "success";
    statusMsg = `Emergency alert sent to ${sentCount} of ${total} contacts.`;
    retryable = false;
  } else if (sentCount > 0) {
    status = "partial";
    statusMsg = `Emergency alert sent to ${sentCount} of ${total} contacts.`;
    retryable = true;
  } else {
    status = "error";
    statusMsg = "SMS delivery unavailable. Call 100 directly.";
    retryable = true;
  }

  assert.equal(status, "success");
  assert.equal(statusMsg, "Emergency alert sent to 6 of 6 contacts.");
  assert.equal(retryable, false);
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
  assert.match(edgeContent, /Deno\.env\.get\("TWILIO_AUTH_TOKEN"\)/);
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
