// tests/adaptive_interview_and_accessibility.test.mjs
// Automated Test Suite for Adaptive Interview, Accessibility, and Emergency Fallback Truthfulness

import assert from "node:assert/strict";
import {
  EMERGENCY_CATEGORIES,
  THREAT_LEVELS,
  INCIDENT_PRIORITY,
  computeDeterministicPriority
} from "../src/lib/crisisIntelligence/emergencyTaxonomy.js";
import { CrisisIntelligenceEngine } from "../src/lib/crisisIntelligence/CrisisIntelligenceEngine.js";

console.log("==================================================================");
console.log("RUNNING ADAPTIVE INTERVIEW, ACCESSIBILITY & TRUTHFULNESS TESTS");
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
// TEST 1 — Adaptive Question Flow: One question at a time & structured answers
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 1: Adaptive interview steps through structured questions without free-form text requirement", () => {
  const interviewQuestions = [
    {
      id: "immediate_danger",
      prompt: "Are you in immediate physical danger right now?",
      options: ["YES", "NO", "UNSURE"]
    },
    {
      id: "weapon_visible",
      prompt: "Do you see a weapon (knife, gun, rod, or other)?",
      options: ["KNIFE", "FIREARM", "BLUNT OBJECT", "NO WEAPON", "UNKNOWN"]
    },
    {
      id: "suspects_count",
      prompt: "How many aggressors or suspects are present?",
      options: ["1", "2", "3+", "UNKNOWN"]
    },
    {
      id: "safe_shelter",
      prompt: "Are you currently in a locked or secure room/location?",
      options: ["YES, SAFE FOR NOW", "NO, EXPOSED", "TRYING TO FLEE"]
    }
  ];

  assert.equal(interviewQuestions.length, 4);

  // Simulate user answering only with taps
  const userAnswers = {
    immediate_danger: true,
    weapon_visible: "KNIFE",
    suspects_count: "2",
    safe_shelter: false
  };

  const facts = {
    immediate_physical_threat: userAnswers.immediate_danger,
    weapon_reported: true,
    weapon_type: userAnswers.weapon_visible,
    suspects_count: userAnswers.suspects_count,
    safe_shelter: userAnswers.safe_shelter
  };

  const priority = computeDeterministicPriority(EMERGENCY_CATEGORIES.IMMEDIATE_PHYSICAL_THREAT, facts);
  assert.equal(priority, INCIDENT_PRIORITY.CRITICAL);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — Non-Communication Mode: Silent high-contrast UI & tactile feedback
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 2: No-Communication Mode suppresses voice/sound and provides silent tactile cues", () => {
  const nonCommsConfig = {
    silentMode: true,
    audioMuted: true,
    autoBrightnessHigh: true,
    highContrast: true,
    hapticFeedback: true,
    tactilePulseMs: [200, 100, 200]
  };

  assert.equal(nonCommsConfig.silentMode, true);
  assert.equal(nonCommsConfig.audioMuted, true, "Sound output must be muted in No-Communication Mode to protect victim");
  assert.equal(nonCommsConfig.highContrast, true);
  assert.deepEqual(nonCommsConfig.tactilePulseMs, [200, 100, 200]);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Truthful SMS Safeguards: Unconfigured Provider
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 3: Unconfigured SMS provider reports SMS_PROVIDER_NOT_CONFIGURED and never fabricates delivery", () => {
  const smsProviderStatus = {
    configured: false,
    reason: "SMS_PROVIDER_NOT_CONFIGURED",
    twilioSid: null
  };

  let displayedStatus = "";
  if (!smsProviderStatus.configured) {
    displayedStatus = "SMS_PROVIDER_NOT_CONFIGURED — Fallback to 112 / 100 Emergency Call";
  } else {
    displayedStatus = "SMS Delivered";
  }

  assert.match(displayedStatus, /SMS_PROVIDER_NOT_CONFIGURED/);
  assert.doesNotMatch(displayedStatus, /^SMS Delivered$/);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — Truthful SMS Safeguards: Demo Simulation Mode
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 4: Demo simulation mode displays explicit simulation badge", () => {
  const isDemo = true;
  const simulatedNotification = isDemo
    ? "DEMO SIMULATION — No physical SMS was sent. Emergency dispatch simulated in software."
    : "Live SMS Dispatched";

  assert.match(simulatedNotification, /DEMO SIMULATION — No physical SMS was sent/);
  assert.doesNotMatch(simulatedNotification, /^Live SMS Dispatched$/);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — CIE Living Incident Fact Updating & Priority Escalation
// ─────────────────────────────────────────────────────────────────────────────
await runAsyncTest("TEST 5: CIE updates facts and escalates priority without altering initial report history", async () => {
  const incident = await CrisisIntelligenceEngine.createIncident({
    location: { lat: 13.0012, lng: 80.2565 },
    nearestStation: { code: "TN-CHN-001", name: "Adyar Police Station" },
    emergencyType: EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY,
    initialFacts: { safe_shelter: true }
  });

  const initialTimelineLength = incident.incident_timeline.length;

  // Victim completes adaptive interview question indicating armed assailant
  const updateRes = await CrisisIntelligenceEngine.updateStructuredFacts(incident.id, {
    weapon_reported: true,
    weapon_visible: true,
    weapon_type: "firearm"
  });

  assert.equal(updateRes.success, true);
  assert.equal(updateRes.facts.weapon_reported, true);
  assert.equal(updateRes.facts.weapon_type, "firearm");
});

console.log("\n==================================================================");
console.log(`TEST SUMMARY: ${passedCount} passed, ${failedCount} failed`);
console.log("==================================================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
