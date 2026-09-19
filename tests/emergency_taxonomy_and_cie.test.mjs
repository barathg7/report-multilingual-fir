// tests/emergency_taxonomy_and_cie.test.mjs
// Automated Test Suite for Emergency Taxonomy and Crisis Intelligence Engine (CIE)

import assert from "node:assert/strict";
import {
  EMERGENCY_CATEGORIES,
  THREAT_LEVELS,
  INCIDENT_PRIORITY,
  PROVENANCE_SOURCES,
  EMERGENCY_TAXONOMY_METADATA,
  isValidEmergencyCategory,
  buildProvenanceRecord,
  computeDeterministicPriority
} from "../src/lib/crisisIntelligence/emergencyTaxonomy.js";
import { CrisisIntelligenceEngine } from "../src/lib/crisisIntelligence/CrisisIntelligenceEngine.js";

console.log("==================================================================");
console.log("RUNNING EMERGENCY TAXONOMY & CRISIS INTELLIGENCE ENGINE (CIE) TESTS");
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
// TEST 1 — Emergency Taxonomy Completeness & Neutrality
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 1: Emergency taxonomy covers core categories with neutral legal wording", () => {
  const categoryKeys = Object.keys(EMERGENCY_CATEGORIES);
  assert.ok(categoryKeys.length >= 10, "Taxonomy must contain at least 10 emergency categories");

  const requiredCategories = [
    "IMMEDIATE_PHYSICAL_THREAT",
    "ARMED_THREAT",
    "HOSTAGE_OR_HOME_INVASION",
    "KIDNAPPING_OR_ABDUCTION",
    "DANGEROUS_PURSUIT",
    "MEDICAL_EMERGENCY",
    "FIRE_OR_DISASTER",
    "BOMB_OR_EXPLOSIVE_THREAT",
    "SEXUAL_ASSAULT_OR_IMMEDIATE_DANGER",
    "MISSING_OR_ENDANGERED_PERSON",
    "OTHER_CRITICAL_EMERGENCY"
  ];

  for (const cat of requiredCategories) {
    assert.ok(EMERGENCY_CATEGORIES[cat], `EMERGENCY_CATEGORIES.${cat} must be defined`);
    const meta = EMERGENCY_TAXONOMY_METADATA[cat];
    assert.ok(meta, `Metadata for ${cat} must exist`);
    assert.ok(meta.label, `${cat} must have a label`);
    assert.ok(meta.tamilLabel, `${cat} must have a Tamil localization label`);
    assert.ok(meta.defaultPriority, `${cat} must have a default priority`);
    assert.ok(meta.defaultThreatLevel, `${cat} must have a default threat level`);

    // Ground rule: No pejorative criminal labels in UI titles
    assert.ok(!meta.label.toLowerCase().includes("terrorist"), `${cat} label must not use speculative label 'terrorist'`);
    assert.ok(!meta.label.toLowerCase().includes("killer"), `${cat} label must not use speculative label 'killer'`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — Deterministic Priority Computation Without AI Speculation
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 2: computeDeterministicPriority calculates priority deterministically", () => {
  // Armed threat must always be CRITICAL
  const p1 = computeDeterministicPriority(EMERGENCY_CATEGORIES.ARMED_THREAT, {});
  assert.equal(p1, INCIDENT_PRIORITY.CRITICAL);

  // Weapon visible must elevate to CRITICAL
  const p2 = computeDeterministicPriority(EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY, { weapon_visible: true });
  assert.equal(p2, INCIDENT_PRIORITY.CRITICAL);

  // 3+ suspects count alone is contextual information and does NOT elevate to CRITICAL
  const p3 = computeDeterministicPriority(EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY, { suspects_count: "3+" });
  assert.equal(p3, INCIDENT_PRIORITY.HIGH);

  // 3+ suspects WITH weapon reported DOES elevate to CRITICAL
  const p3WithWeapon = computeDeterministicPriority(EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY, { suspects_count: "3+", weapon_reported: true });
  assert.equal(p3WithWeapon, INCIDENT_PRIORITY.CRITICAL);

  // Default Medical Emergency is HIGH
  const p4 = computeDeterministicPriority(EMERGENCY_CATEGORIES.MEDICAL_EMERGENCY, {});
  assert.equal(p4, INCIDENT_PRIORITY.HIGH);

  // Missing person with no immediate weapon/threat defaults to HIGH
  const p5 = computeDeterministicPriority(EMERGENCY_CATEGORIES.MISSING_OR_ENDANGERED_PERSON, {});
  assert.equal(p5, INCIDENT_PRIORITY.HIGH);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Provenance Record Integrity
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 3: buildProvenanceRecord creates auditable metadata", () => {
  const prov = buildProvenanceRecord({
    source: PROVENANCE_SOURCES.ADAPTIVE_INTERVIEW,
    userConfirmed: true,
    confidence: 0.95,
    location: { lat: 13.0012, lng: 80.2565, accuracy: 8.2 },
    emergencyType: EMERGENCY_CATEGORIES.IMMEDIATE_PHYSICAL_THREAT,
    threatLevel: THREAT_LEVELS.ACTIVE_THREAT
  });

  assert.equal(prov.source, PROVENANCE_SOURCES.ADAPTIVE_INTERVIEW);
  assert.equal(prov.user_confirmed, true);
  assert.equal(prov.confidence, 0.95);
  assert.equal(prov.location.lat, 13.0012);
  assert.equal(prov.location.lng, 80.2565);
  assert.equal(prov.location.accuracy, 8);
  assert.equal(prov.emergency_type, EMERGENCY_CATEGORIES.IMMEDIATE_PHYSICAL_THREAT);
  assert.equal(prov.threat_level, THREAT_LEVELS.ACTIVE_THREAT);
  assert.ok(prov.timestamp);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — CIE createIncident Lifecycle & Schema
// ─────────────────────────────────────────────────────────────────────────────
await runAsyncTest("TEST 4: CrisisIntelligenceEngine.createIncident builds living incident", async () => {
  const incident = await CrisisIntelligenceEngine.createIncident({
    location: { lat: 13.0012, lng: 80.2565, accuracy: 10 },
    nearestStation: { code: "TN-CHN-001", name: "Adyar Police Station" },
    emergencyType: EMERGENCY_CATEGORIES.IMMEDIATE_PHYSICAL_THREAT,
    source: PROVENANCE_SOURCES.WEB_QUICKSHIELD,
    initialFacts: { weapon_reported: true },
    userNotes: "Pursued by aggressive person"
  });

  assert.ok(incident.id, "Incident must have a unique ID");
  assert.equal(incident.status, "active");
  assert.equal(incident.priority, INCIDENT_PRIORITY.CRITICAL);
  assert.equal(incident.threat_level, THREAT_LEVELS.CRITICAL_THREAT);
  assert.equal(incident.nearest_station_code, "TN-CHN-001");
  assert.equal(incident.nearest_station_name, "Adyar Police Station");
  assert.ok(Array.isArray(incident.incident_timeline), "Timeline must be an array");
  assert.ok(incident.incident_timeline.length >= 1, "Must have initial timeline event");
  assert.equal(incident.incident_timeline[0].event_type, "EMERGENCY_ACTIVATED");
  assert.equal(incident.incident_facts.weapon_reported, true);
  assert.ok(incident.incident_facts.provenance, "Provenance record must be nested in facts");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — CIE appendTimelineEvent
// ─────────────────────────────────────────────────────────────────────────────
await runAsyncTest("TEST 5: CrisisIntelligenceEngine.appendTimelineEvent appends chronological events", async () => {
  const incident = await CrisisIntelligenceEngine.createIncident({
    location: { lat: 13.0827, lng: 80.2707, accuracy: 5 },
    nearestStation: { code: "TN-CHN-002", name: "Anna Nagar PS" },
    emergencyType: EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY,
    source: PROVENANCE_SOURCES.WEB_QUICKSHIELD
  });

  const res = await CrisisIntelligenceEngine.appendTimelineEvent(incident.id, {
    eventType: "FACTS_UPDATED",
    description: "Citizen reported attacker armed with blunt object",
    actor: "CITIZEN",
    source: PROVENANCE_SOURCES.ADAPTIVE_INTERVIEW,
    metadata: { weapon: "blunt_object" }
  });

  assert.equal(res.success, true);
  assert.ok(res.event);
  assert.equal(res.event.event_type, "FACTS_UPDATED");
  assert.equal(res.event.actor, "CITIZEN");
  assert.equal(res.event.source, PROVENANCE_SOURCES.ADAPTIVE_INTERVIEW);
  assert.ok(res.event.timestamp);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6 — CIE evolveThreatLevel
// ─────────────────────────────────────────────────────────────────────────────
await runAsyncTest("TEST 6: CrisisIntelligenceEngine.evolveThreatLevel advances incident threat state", async () => {
  const incident = await CrisisIntelligenceEngine.createIncident({
    location: { lat: 13.0400, lng: 80.2500, accuracy: 15 },
    nearestStation: { code: "TN-CHN-003", name: "T.Nagar PS" },
    emergencyType: EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY
  });

  const res = await CrisisIntelligenceEngine.evolveThreatLevel(
    incident.id,
    THREAT_LEVELS.CRITICAL_THREAT,
    "Citizen entered secure shelter but threat remains active outside",
    "CITIZEN"
  );

  assert.equal(res.success, true);
  assert.equal(res.new_level, THREAT_LEVELS.CRITICAL_THREAT);
});

console.log("\n==================================================================");
console.log(`TEST SUMMARY: ${passedCount} passed, ${failedCount} failed`);
console.log("==================================================================");

if (failedCount > 0) {
  process.exit(1);
}
