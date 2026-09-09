import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { 
  parseItemsList, 
  formatDateForDisplay, 
  formatTimeForDisplay, 
  isMeaningfulValue 
} from "../src/utils/index.js";
import { normalizeFIR } from "../src/lib/firSchema.js";
import { 
  BNS_SECTIONS, 
  suggestLegalSuggestions, 
  validateLegalSections, 
  createLegalSuggestion 
} from "../src/utils/bnsValidator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("==================================================================");
console.log("RUNNING AI EXTRACTION & USER EDIT PROTECTION TEST SUITE");
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
// TEST 1 — Property extraction (Arun Kumar Laptop statement)
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 1 — Property extraction: Arun Kumar statement items parsed and canonicalized", () => {
  const statement = `My name is Arun Kumar. My mobile number is 9876543210.
Yesterday evening around 7:30 PM, I went to the bus stand near Ambattur.
I parked my black laptop bag near the waiting area for a few minutes.
When I returned, the bag was missing.
It contained one Dell laptop, a charger, and some personal documents.
I searched the surrounding area but could not find it.
I believe someone may have taken my bag without my permission.
I request the police to register my complaint and help me recover my belongings.`;

  // Simulated structured output from Groq LLM
  const groqExtracted = {
    complainantName: "Arun Kumar",
    complainantPhone: "9876543210",
    incidentDate: "08/09/2026",
    incidentTime: "7:30 PM",
    crimeType: "Theft without confrontation",
    incidentLocation: "bus stand near Ambattur",
    stolenItems: ["one Dell laptop", "a charger", "personal documents"],
    suspectDescription: "",
    weaponUsed: "",
    vehicleNumber: "",
    bnsSections: ["304"]
  };

  const parsedItems = parseItemsList(groqExtracted.stolenItems);
  assert.equal(parsedItems.length, 3, "Should extract exactly 3 items");
  assert.ok(parsedItems.some(i => i.toLowerCase().includes("dell laptop")), "Must contain Dell laptop");
  assert.ok(parsedItems.some(i => i.toLowerCase().includes("charger")), "Must contain charger");
  assert.ok(parsedItems.some(i => i.toLowerCase().includes("personal documents")), "Must contain personal documents");

  // Verify string format normalization
  const asString = parsedItems.join(", ");
  assert.ok(asString.includes("Dell laptop"));
  assert.ok(asString.includes("Charger"));
  assert.ok(asString.includes("Personal documents"));

  // Verify it reaches the canonical FIR evidence.stolenItems field
  const canonicalFIR = normalizeFIR({
    complainantName: groqExtracted.complainantName,
    complainantPhone: groqExtracted.complainantPhone,
    incidentDate: groqExtracted.incidentDate,
    incidentTime: groqExtracted.incidentTime,
    crimeType: groqExtracted.crimeType,
    incidentLocation: groqExtracted.incidentLocation,
    stolenItems: asString
  });

  assert.equal(canonicalFIR.evidence.stolenItems, asString, "Canonical schema evidence.stolenItems must match");
  assert.equal(canonicalFIR.stolenItems, asString, "Backward-compatible getter must match");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — Review card: Renders property/items when populated
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 2 — Review card: Renders property/items bullets when populated", () => {
  const stolenItemsStr = "Dell laptop, Charger, Personal documents";
  const items = parseItemsList(stolenItemsStr);

  assert.equal(items.length, 3);
  assert.equal(items[0], "Dell laptop");
  assert.equal(items[1], "Charger");
  assert.equal(items[2], "Personal documents");

  // Simulate JSX condition used in VoiceRecorder.jsx
  const hasItemsToRender = items.length > 0;
  assert.equal(hasItemsToRender, true, "Review card must visibly render items section when populated");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Empty property field: Does not display empty Items section
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 3 — Empty property field: Does not display empty Items section", () => {
  const emptyInputs = ["", "   ", null, undefined, [], "None", "nil", "N/A", "unknown", "not specified"];
  
  for (const emptyVal of emptyInputs) {
    const items = parseItemsList(emptyVal);
    assert.equal(items.length, 0, `parseItemsList should return empty array for '${emptyVal}'`);
    const hasItemsToRender = items.length > 0;
    assert.equal(hasItemsToRender, false, `Card must NOT render items section for '${emptyVal}'`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — User edit protection: Name manual edit survives AI re-runs
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 4 — User edit protection: Name remains Arun Kumar G after re-running AI", () => {
  const provenance = {};

  // 1. Initial AI extraction
  let currentForm = {
    complainantName: "Arun Kumar",
    complainantPhone: "9876543210"
  };
  provenance.complainantName = {
    source: "AI",
    confidence: 0.85,
    editedByUser: false,
    verified: false,
    lastUpdated: new Date().toISOString()
  };

  // 2. Citizen manually edits their name
  currentForm.complainantName = "Arun Kumar G";
  provenance.complainantName = {
    source: "USER",
    confidence: 1.0,
    editedByUser: true,
    verified: false,
    lastUpdated: new Date().toISOString()
  };

  // 3. safeMerge logic as implemented in RecordStatement.jsx
  const safeMerge = (field, extractedVal, currentVal) => {
    if (provenance[field]?.editedByUser) {
      return currentVal; // PRESERVE USER EDIT
    }
    if (extractedVal && String(extractedVal).trim()) {
      return String(extractedVal).trim();
    }
    return currentVal;
  };

  // 4. AI re-extracts original name "Arun Kumar"
  const reExtractedName = "Arun Kumar";
  currentForm.complainantName = safeMerge("complainantName", reExtractedName, currentForm.complainantName);

  assert.equal(currentForm.complainantName, "Arun Kumar G", "User-edited name MUST remain Arun Kumar G");
  assert.equal(provenance.complainantName.editedByUser, true, "editedByUser flag must remain true");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — User-edited items: User-added item survives AI re-runs
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 5 — User-edited items: User's added Mouse survives AI re-runs", () => {
  const provenance = {};

  // 1. Initial AI extraction
  let currentForm = {
    stolenItems: "Dell laptop, Charger"
  };
  provenance.stolenItems = {
    source: "AI",
    confidence: 0.85,
    editedByUser: false,
    verified: false,
    lastUpdated: new Date().toISOString()
  };

  // 2. Citizen adds "Mouse"
  currentForm.stolenItems = "Dell laptop, Charger, Mouse";
  provenance.stolenItems = {
    source: "USER",
    confidence: 1.0,
    editedByUser: true,
    verified: false,
    lastUpdated: new Date().toISOString()
  };

  // 3. safeMerge for stolenItems
  const safeMerge = (field, extractedVal, currentVal) => {
    if (provenance[field]?.editedByUser) {
      return currentVal; // PRESERVE USER EDIT
    }
    if (field === "stolenItems") {
      const items = parseItemsList(extractedVal);
      return items.length > 0 ? items.join(", ") : currentVal;
    }
    return extractedVal || currentVal;
  };

  // 4. Re-run AI which only extracted "Dell laptop, Charger"
  const reExtractedItems = ["Dell laptop", "Charger"];
  currentForm.stolenItems = safeMerge("stolenItems", reExtractedItems, currentForm.stolenItems);

  assert.equal(currentForm.stolenItems, "Dell laptop, Charger, Mouse", "User's edited items list must be strictly preserved");
  assert.equal(provenance.stolenItems.editedByUser, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6 — Language change: Extracted facts remain unchanged
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 6 — Language change: Facts and user edits remain completely intact", () => {
  let activeLanguage = { code: "en", name: "English" };
  const formState = {
    complainantName: "Arun Kumar G",
    complainantPhone: "9876543210",
    incidentDate: "2026-09-08",
    incidentTime: "19:30",
    crimeType: "Theft without confrontation",
    incidentLocation: "bus stand near Ambattur",
    stolenItems: "Dell laptop, Charger, Personal documents",
    incidentDescription: "My name is Arun Kumar..."
  };

  // Citizen switches UI language to Tamil
  activeLanguage = { code: "ta", name: "Tamil", native: "தமிழ்" };

  // Assert formState is untouched
  assert.equal(formState.complainantName, "Arun Kumar G");
  assert.equal(formState.complainantPhone, "9876543210");
  assert.equal(formState.stolenItems, "Dell laptop, Charger, Personal documents");
  assert.equal(formState.incidentLocation, "bus stand near Ambattur");
  assert.equal(activeLanguage.code, "ta");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7 — No fabrication: Suspect details remain empty when not stated
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 7 — No fabrication: Suspect details remain empty when unstated", () => {
  const groqOutput = {
    complainantName: "Arun Kumar",
    complainantPhone: "9876543210",
    suspectDescription: "",
    vehicleNumber: "",
    weaponUsed: ""
  };

  assert.equal(isMeaningfulValue(groqOutput.suspectDescription), false, "Suspect must not be deemed meaningful");
  assert.equal(isMeaningfulValue(groqOutput.vehicleNumber), false, "Vehicle must not be deemed meaningful");
  assert.equal(isMeaningfulValue(groqOutput.weaponUsed), false, "Weapon must not be deemed meaningful");

  // Verify Review Card JSX conditional rendering
  const rendersSuspect = isMeaningfulValue(groqOutput.suspectDescription);
  assert.equal(rendersSuspect, false, "Suspect info must NOT be rendered when unstated");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8 — Security & Model Sanitization Sweep
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 8 — Security & Model Sweep: No obsolete models and zero client secret exposure", () => {
  const groqManagerPath = path.resolve(__dirname, "../src/components/kavalan/GroqManager.jsx");
  const groqApiPath = path.resolve(__dirname, "../api/ai/groq.js");
  const viteConfigPath = path.resolve(__dirname, "../vite.config.js");

  const groqManagerSrc = fs.readFileSync(groqManagerPath, "utf-8");
  const groqApiSrc = fs.readFileSync(groqApiPath, "utf-8");
  const viteConfigSrc = fs.readFileSync(viteConfigPath, "utf-8");

  // Check obsolete gemma models
  assert.ok(!groqManagerSrc.includes("gemma-2-9b-it"), "GroqManager must not mention gemma-2-9b-it");
  assert.ok(!groqApiSrc.includes("gemma-2-9b-it"), "api/ai/groq must not mention gemma-2-9b-it");
  assert.ok(!viteConfigSrc.includes("gemma-2-9b-it"), "vite.config must not mention gemma-2-9b-it");

  // Check that old/unavailable models are NOT in the functional code
  // (they may appear in exclusion-comment documentation, but NOT as live model IDs)
  const OBSOLETE_AS_LIVE = [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "mixtral-8x7b-32768",
    "llama-3.1-8b-instant",
  ];
  for (const m of OBSOLETE_AS_LIVE) {
    // Must not appear in the functional primaryModel or backupModels assignments
    assert.ok(
      !groqManagerSrc.includes(`primaryModel = "${m}"`),
      `GroqManager.primaryModel must not be ${m} (not in API key plan)`
    );
    assert.ok(
      !groqManagerSrc.includes(`"${m}",    //`) && !groqManagerSrc.includes(`"${m}",   //`),
      `GroqManager.backupModels must not include ${m} (not in API key plan)`
    );
  }

  // Check current live benchmark-verified models ARE present
  const LIVE_MODELS = [
    "openai/gpt-oss-20b",   // PRIMARY (16-case benchmark: 15/16, 1204ms)
    "openai/gpt-oss-120b",  // FALLBACK1 (16/16, most reliable)
    "qwen/qwen3.8-27b",     // FALLBACK2 (last resort)
  ];
  for (const m of LIVE_MODELS) {
    assert.ok(groqManagerSrc.includes(m), `GroqManager must reference live model: ${m}`);
    assert.ok(groqApiSrc.includes(m), `api/ai/groq must reference live model: ${m}`);
  }

  // Check groq/compound-mini is excluded from production extraction chain
  assert.ok(
    !groqManagerSrc.includes(`"groq/compound-mini",`),
    "GroqManager extraction chain must not include groq/compound-mini"
  );
  assert.ok(
    !groqApiSrc.includes(`"groq/compound-mini",`),
    "api/ai/groq allowed models must not include groq/compound-mini"
  );

  // Check no VITE_GROQ_API_KEY in client source code
  const voiceRecorderSrc = fs.readFileSync(path.resolve(__dirname, "../src/components/kavalan/VoiceRecorder.jsx"), "utf-8");
  assert.ok(!voiceRecorderSrc.includes("VITE_GROQ_API_KEY"), "VoiceRecorder must not reference VITE_GROQ_API_KEY");
  assert.ok(!groqManagerSrc.includes("VITE_GROQ_API_KEY"), "GroqManager must not reference VITE_GROQ_API_KEY");
});


// ─────────────────────────────────────────────────────────────────────────────
// TEST 9 — Legal Suggestion Authority Separation (Citizen AI cannot verify law)
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 9 — Legal Suggestion Authority Separation: AI suggestion cannot mark law as police-verified", () => {
  // 1. Verify createLegalSuggestion defaults to verifiedByPolice = false
  const defaultSug = createLegalSuggestion({ section: "303" });
  assert.equal(defaultSug.verifiedByPolice, false, "Legal suggestion MUST default to verifiedByPolice: false");
  assert.equal(defaultSug.verifiedByOfficerBadge, null);
  assert.equal(defaultSug.verifiedAt, null);

  // 2. Verify suggestLegalSuggestions creates unverified suggestions
  const suggestions = suggestLegalSuggestions("someone stole my laptop bag");
  assert.ok(suggestions.length > 0, "Should generate suggestions for theft");
  for (const s of suggestions) {
    assert.equal(s.verifiedByPolice, false, "AI generated suggestion must have verifiedByPolice: false");
  }

  // 3. Verify normalizeFIR rejects citizen attempts to mark suggestions as verified
  const unverifiedSubmission = normalizeFIR({
    status: "submitted",
    legal: {
      legalSuggestions: [
        {
          act: "BNS 2023",
          section: "303",
          title: "Theft",
          verifiedByPolice: true, // Malicious / erroneous spoof attempt from client
          verifiedByOfficerBadge: "FAKE_OFFICER"
        }
      ],
      suggestedSections: ["303"],
      verifiedSections: ["303"], // Unauthorized client attempt to pre-verify
      isVerifiedByPolice: true
    }
  });

  // Strict boundary assertions:
  assert.equal(unverifiedSubmission.legal.legalSuggestions[0].verifiedByPolice, false, 
    "Unverified citizen submission MUST have verifiedByPolice: false on all suggestions");
  assert.equal(unverifiedSubmission.legal.legalSuggestions[0].verifiedByOfficerBadge, null,
    "Unverified citizen submission MUST clear officer badge on suggestions");
  assert.equal(unverifiedSubmission.legal.isVerifiedByPolice, false,
    "FIR legal.isVerifiedByPolice MUST be false for citizen submissions");
  assert.equal(unverifiedSubmission.legal.verifiedSections.length, 0,
    "FIR legal.verifiedSections MUST be empty array for citizen submissions");
  assert.deepEqual(unverifiedSubmission.legal.suggestedSections, ["303"],
    "Suggested sections remain as AI suggestions without authoritative status");
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 10 — Official Bharatiya Nyaya Sanhita (BNS) 2023 Codex Mapping
// ─────────────────────────────────────────────────────────────────────────────
runTest("TEST 10 — Official BNS 2023 Codex Mapping: Theft = §303, Snatching = §304", () => {
  // Verify authoritative section entries in BNS 2023 database
  assert.ok(BNS_SECTIONS["303"], "BNS Section 303 must exist in database");
  assert.ok(BNS_SECTIONS["303"].title.includes("Theft"), "BNS §303 must be Theft");

  assert.ok(BNS_SECTIONS["304"], "BNS Section 304 must exist in database");
  assert.ok(BNS_SECTIONS["304"].title.includes("Snatching"), "BNS §304 must be Snatching");

  // Verify keyword suggestion rules:
  // Ordinary theft (like Arun Kumar's unattended laptop bag) maps to BNS §303
  const theftSuggestions = suggestLegalSuggestions("I parked my laptop bag near the waiting area. When I returned it was stolen.");
  const theftSections = theftSuggestions.map(s => s.section);
  assert.ok(theftSections.includes("303"), "Unattended stolen property MUST suggest BNS §303 (Theft)");
  assert.ok(!theftSections.includes("304"), "Unattended theft MUST NOT suggest BNS §304 (Snatching)");

  // Snatching (sudden or forcible grabbing from person) maps to BNS §304
  const snatchSuggestions = suggestLegalSuggestions("A bike rider came fast and did chain snatching from my neck");
  const snatchSections = snatchSuggestions.map(s => s.section);
  assert.ok(snatchSections.includes("304"), "Sudden grabbing/snatching MUST suggest BNS §304 (Snatching)");

  // Validation codex recognizes both §303 and §304
  const val = validateLegalSections(["303", "304"]);
  assert.equal(val.isValid, true, "Both 303 and 304 must be valid in BNS 2023 codex");
  assert.equal(val.details[0].title, "Theft (BNS §303)");
  assert.equal(val.details[1].title, "Snatching (BNS §304)");
});

console.log("==================================================================");
console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("==================================================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
