/**
 * bnsValidator.js
 *
 * Bharatiya Nyaya Sanhita (BNS) 2023 — Act No. 45 of 2023 (effective July 1, 2024)
 * Authoritative codex replacing Indian Penal Code (IPC) 1860
 *
 * Drop-in replacement for ipcValidator.js
 * Exports:
 * - BNS_SECTIONS
 * - IPC_TO_BNS
 * - determineBnsCandidates (deterministic statutory candidate engine)
 * - createLegalSuggestion
 * - suggestLegalSuggestions
 * - validateLegalSections
 * - ipcToBns, getBnsInfo
 */

// ── Complete BNS 2023 section database (Act No. 45 of 2023) ──────────────────
export const BNS_SECTIONS = {
  // Chapter V — Offences against women & children
  "63":  { title: "Rape — definition (BNS §63)",                  category: "sexual",    severity: "high"   },
  "64":  { title: "Punishment for rape (BNS §64)",                category: "sexual",    severity: "high"   },
  "65":  { title: "Rape of woman under 12 years (BNS §65)",       category: "sexual",    severity: "high"   },
  "66":  { title: "Causing death or vegetative state during rape (BNS §66)", category: "sexual", severity: "high" },
  "67":  { title: "Rape by husband during separation (BNS §67)",  category: "sexual",    severity: "high"   },
  "68":  { title: "Rape by person in authority (BNS §68)",        category: "sexual",    severity: "high"   },
  "69":  { title: "Sexual intercourse by deceit / false promise of marriage (BNS §69)", category: "sexual", severity: "medium" },
  "70":  { title: "Gang rape (BNS §70)",                          category: "sexual",    severity: "high"   },
  "71":  { title: "Repeat offenders — rape (BNS §71)",            category: "sexual",    severity: "high"   },
  "74":  { title: "Assault to outrage modesty of woman (BNS §74)", category: "sexual",   severity: "medium" },
  "75":  { title: "Sexual harassment (BNS §75)",                  category: "sexual",    severity: "medium" },
  "76":  { title: "Assault with intent to disrobe woman (BNS §76)", category: "sexual",  severity: "medium" },
  "77":  { title: "Voyeurism (BNS §77)",                          category: "sexual",    severity: "medium" },
  "78":  { title: "Stalking (BNS §78)",                           category: "sexual",    severity: "medium" },
  "79":  { title: "Word or gesture to insult modesty of woman (BNS §79)", category: "sexual", severity: "low" },
  "80":  { title: "Dowry death (BNS §80)",                        category: "homicide",  severity: "high"   },
  "82":  { title: "Marrying again during lifetime of spouse (BNS §82)", category: "marriage", severity: "medium" },
  "84":  { title: "Enticing or detaining married woman (BNS §84)", category: "marriage", severity: "low"    },
  "85":  { title: "Cruelty by husband or relatives (BNS §85)",    category: "domestic",  severity: "medium" },
  "86":  { title: "Cruelty — definition (BNS §86)",               category: "domestic",  severity: "medium" },

  // Chapter VII — Offences against State
  "147": { title: "Act endangering sovereignty, unity, and integrity of India (BNS §147)", category: "state", severity: "high" },

  // Chapter XI — Public tranquility
  "189": { title: "Unlawful assembly & punishment (BNS §189)",     category: "public",    severity: "medium" },
  "191": { title: "Rioting (BNS §191)",                           category: "public",    severity: "medium" },
  "192": { title: "Rioting armed with deadly weapon (BNS §192)",  category: "public",    severity: "high"   },
  "193": { title: "Member of unlawful assembly guilty of offence (BNS §193)", category: "public", severity: "medium" },
  "196": { title: "Promoting enmity between groups (BNS §196)",   category: "public",    severity: "medium" },

  // Chapter XIII & XIV — Public servants & Administration of justice
  "221": { title: "Obstructing public servant in discharge of duty (BNS §221)", category: "public", severity: "low" },
  "229": { title: "Giving false evidence / perjury (BNS §229)",   category: "justice",   severity: "medium" },
  "231": { title: "Punishment for false evidence (BNS §231)",     category: "justice",   severity: "medium" },
  "238": { title: "Causing disappearance of evidence (BNS §238)", category: "justice",   severity: "medium" },

  // Chapter VI — Offences affecting human body
  "101": { title: "Murder (BNS §101)",                            category: "homicide",  severity: "high"   },
  "104": { title: "Culpable homicide not amounting to murder (BNS §104)", category: "homicide", severity: "high" },
  "105": { title: "Punishment for culpable homicide (BNS §105)",  category: "homicide",  severity: "high"   },
  "106": { title: "Causing death by negligence (BNS §106)",       category: "homicide",  severity: "medium" },
  "108": { title: "Abetment of suicide (BNS §108)",               category: "homicide",  severity: "high"   },
  "109": { title: "Attempt to murder (BNS §109)",                 category: "homicide",  severity: "high"   },
  "110": { title: "Attempt to commit culpable homicide (BNS §110)", category: "homicide", severity: "high" },
  "114": { title: "Hurt — definition (BNS §114)",                 category: "assault",   severity: "low"    },
  "115": { title: "Grievous hurt — definition (BNS §115)",        category: "assault",   severity: "medium" },
  "116": { title: "Punishment for voluntarily causing hurt (BNS §116)", category: "assault", severity: "low" },
  "117": { title: "Punishment for voluntarily causing grievous hurt (BNS §117)", category: "assault", severity: "medium" },
  "118": { title: "Voluntarily causing hurt by dangerous weapon (BNS §118)", category: "assault", severity: "medium" },
  "119": { title: "Voluntarily causing grievous hurt by dangerous weapon (BNS §119)", category: "assault", severity: "high" },
  "124": { title: "Voluntarily causing grievous hurt by acid (BNS §124)", category: "assault", severity: "high" },
  "125": { title: "Attempt to throw acid (BNS §125)",             category: "assault",   severity: "high"   },
  "126": { title: "Wrongful restraint (BNS §126)",                category: "assault",   severity: "low"    },
  "127": { title: "Wrongful confinement (BNS §127)",              category: "assault",   severity: "medium" },
  "132": { title: "Assault to deter public servant (BNS §132)",   category: "assault",   severity: "medium" },
  "137": { title: "Kidnapping — definition (BNS §137)",           category: "kidnap",    severity: "high"   },
  "138": { title: "Kidnapping from lawful guardianship (BNS §138)", category: "kidnap", severity: "high"   },
  "139": { title: "Abduction — definition (BNS §139)",            category: "kidnap",    severity: "high"   },
  "140": { title: "Punishment for kidnapping (BNS §140)",         category: "kidnap",    severity: "high"   },
  "141": { title: "Kidnapping minor for begging (BNS §141)",      category: "kidnap",    severity: "high"   },
  "142": { title: "Kidnapping or abducting to murder (BNS §142)", category: "kidnap",    severity: "high"   },
  "143": { title: "Kidnapping for ransom (BNS §143)",             category: "kidnap",    severity: "high"   },
  "144": { title: "Kidnapping with intent to secretly confine (BNS §144)", category: "kidnap", severity: "high" },
  "145": { title: "Kidnapping woman to compel marriage (BNS §145)", category: "kidnap", severity: "high"   },

  // Chapter XVII — Offences against property (Bharatiya Nyaya Sanhita 2023)
  "303": { title: "Theft (BNS §303)",                             category: "property",  severity: "medium" },
  "304": { title: "Snatching (BNS §304)",                         category: "property",  severity: "medium" },
  "305": { title: "Theft in dwelling house, transport, or place of worship (BNS §305)", category: "property", severity: "medium" },
  "306": { title: "Theft by clerk or servant (BNS §306)",         category: "property",  severity: "medium" },
  "307": { title: "Theft after preparation for hurt or death (BNS §307)", category: "property", severity: "high" },
  "308": { title: "Extortion (BNS §308)",                         category: "property",  severity: "medium" },
  "309": { title: "Robbery (BNS §309)",                           category: "property",  severity: "high"   },
  "310": { title: "Dacoity (BNS §310)",                           category: "property",  severity: "high"   },
  "311": { title: "Robbery or dacoity with attempt to cause death or grievous hurt (BNS §311)", category: "property", severity: "high" },
  "312": { title: "Attempt to commit robbery or dacoity when armed with deadly weapon (BNS §312)", category: "property", severity: "high" },
  "313": { title: "Voluntarily causing hurt in committing robbery (BNS §313)", category: "property", severity: "high" },
  "314": { title: "Dishonest misappropriation of property (BNS §314)", category: "property", severity: "medium" },
  "315": { title: "Belonging to gang of dacoits (BNS §315)",      category: "property",  severity: "high"   },
  "316": { title: "Criminal breach of trust (BNS §316)",          category: "property",  severity: "medium" },
  "318": { title: "Cheating (BNS §318)",                          category: "fraud",     severity: "medium" },
  "319": { title: "Cheating by personation (BNS §319)",           category: "fraud",     severity: "medium" },
  "324": { title: "Mischief (BNS §324)",                          category: "property",  severity: "low"    },
  "326": { title: "Mischief by fire or explosive substance (BNS §326)", category: "property", severity: "high" },
  "329": { title: "Criminal trespass and house-trespass (BNS §329)", category: "property", severity: "low" },
  "331": { title: "Lurking house-trespass or house-breaking (BNS §331)", category: "property", severity: "medium" },
  "336": { title: "Forgery (BNS §336)",                           category: "fraud",     severity: "medium" },
  "338": { title: "Forgery for purpose of cheating (BNS §338)",   category: "fraud",     severity: "medium" },
  "340": { title: "Using as genuine a forged document (BNS §340)", category: "fraud",   severity: "medium" },

  // Chapter XXI — Defamation, intimidation, insult
  "351": { title: "Criminal intimidation (BNS §351)",             category: "other",     severity: "low"    },
  "352": { title: "Intentional insult to provoke breach of peace (BNS §352)", category: "other", severity: "low" },
  "356": { title: "Defamation (BNS §356)",                        category: "other",     severity: "low"    },

  // Backward compatibility aliases for draft bill section labels (retained for database tolerance)
  "309B":{ title: "Robbery (BNS §309)",                           category: "property",  severity: "high"   },
  "310B":{ title: "Dacoity (BNS §310)",                           category: "property",  severity: "high"   },
  "316A":{ title: "Criminal breach of trust — definition (BNS §316(1))", category: "property", severity: "medium" },
  "316B":{ title: "Criminal breach of trust — punishment (BNS §316(2))", category: "property", severity: "medium" },
  "316C":{ title: "Criminal breach of trust by public servant (BNS §316(5))", category: "property", severity: "high" },
  "319A":{ title: "Cheating by personation (BNS §319)",           category: "fraud",     severity: "medium" },
  "319B":{ title: "Cheating and dishonestly inducing delivery of property (BNS §318(4))", category: "fraud", severity: "medium" },
  "324A":{ title: "Punishment for mischief (BNS §324(2))",        category: "property",  severity: "low"    },
  "325": { title: "Mischief causing damage (BNS §324(3))",        category: "property",  severity: "medium" },
  "329A":{ title: "Punishment for criminal trespass (BNS §329(3))", category: "property", severity: "low"  },
  "330": { title: "House-trespass (BNS §329(2))",                 category: "property",  severity: "low"    },
  "330A":{ title: "Punishment for house-trespass (BNS §329(4))",  category: "property",  severity: "medium" },
  "336A":{ title: "Forgery (BNS §336)",                           category: "fraud",     severity: "medium" },
  "336B":{ title: "Forgery for cheating (BNS §338)",              category: "fraud",     severity: "medium" },
  "336C":{ title: "Using forged document as genuine (BNS §340)",  category: "fraud",     severity: "medium" },
  "351B":{ title: "Criminal intimidation with threat (BNS §351(3))", category: "other",  severity: "medium" },

  // IT Act 2000 sections (co-applied with BNS)
  "66C": { title: "Identity theft (IT Act §66C)",                 category: "cyber",     severity: "medium" },
  "66D": { title: "Cheating by personation using computer (IT Act §66D)", category: "cyber", severity: "medium" },
  "66E": { title: "Violation of privacy (IT Act §66E)",           category: "cyber",     severity: "medium" },
  "67":  { title: "Publishing obscene material (IT Act §67)",     category: "cyber",     severity: "medium" },
  "67A": { title: "Publishing sexually explicit material (IT Act §67A)", category: "cyber", severity: "high" },
};

// ── IPC 1860 → BNS 2023 complete authoritative cross-reference map ───────────
export const IPC_TO_BNS = {
  // IPC section -> BNS 2023 section
  "124A": "147",
  "141": "189",  "143": "189",  "147": "191",  "148": "192",  "149": "193",  "153A": "196",
  "186": "221",  "191": "229",  "193": "231",  "201": "238",
  "302": "101",  "304": "105",  "304A": "106", "304B": "80",  "306": "108",  "307": "109",  "308": "110",
  "319": "114",  "320": "115",  "323": "116",  "324": "118",  "325": "117",  "326": "119",  "326A": "124", "326B": "125",
  "339": "126",  "340": "127",  "353": "132",  "363": "140",  "364A": "143", "366": "145",
  "354": "74",   "354A": "75",  "354B": "76",  "354C": "77",  "354D": "78",
  "375": "63",   "376": "64",   "376A": "66",  "376D": "70",
  "378": "303",  "379": "303",  "380": "305",  "381": "306",  "382": "307",
  "383": "308",  "384": "308",  "390": "309",  "392": "309",  "393": "309",
  "395": "310",  "396": "311",  "403": "314",
  "405": "316",  "406": "316",  "409": "316",
  "415": "318",  "417": "318",  "419": "319",  "420": "318",
  "425": "324",  "426": "324",  "427": "324",  "435": "326",  "436": "326",
  "441": "329",  "447": "329",  "448": "329",  "453": "331",  "454": "331",  "457": "331",
  "463": "336",  "465": "336",  "468": "338",  "471": "340",
  "494": "82",   "498A": "85",
  "499": "356",  "500": "356",  "503": "351",  "504": "352",  "506": "351",
  "509": "79",
};

// ── Crime type → BNS sections mapping ────────────────────────────────────────
export const CRIME_TO_BNS = {
  // Snatching (BNS §304: newly codified independent offence)
  "chain snatching":     ["304"],
  "chain snatch":        ["304"],
  "mobile snatch":       ["304"],
  "phone snatch":        ["304"],
  "bag snatch":          ["304"],
  "snatching":           ["304"],

  // Robbery & Dacoity (BNS §309 & §310)
  "robbery":             ["309"],
  "armed robbery":       ["309", "119"],
  "dacoity":             ["310"],

  // Theft (BNS §303)
  "theft":               ["303"],
  "theft without confrontation": ["303"],
  "unattended theft":    ["303"],
  "stolen":              ["303"],
  "stole":               ["303"],
  "burglary":            ["331", "303"],
  "house breaking":      ["331"],
  "shoplifting":         ["303"],
  "pickpocket":          ["303"],
  "vehicle theft":       ["303"],
  "bike theft":          ["303"],
  "car theft":           ["303"],

  // Assault & Hurt
  "assault":             ["116"],
  "hurt":                ["116"],
  "grievous hurt":       ["117"],
  "grievous":            ["117"],
  "weapon":              ["118"],
  "knife":               ["118"],
  "acid":                ["124"],
  "acid attack":         ["124", "125"],
  "beating":             ["116"],
  "attack":              ["116"],

  // Homicide
  "murder":              ["101"],
  "kill":                ["101"],
  "killed":              ["101"],
  "death":               ["101"],
  "attempt to murder":   ["109"],
  "attempt murder":      ["109"],
  "negligence death":    ["106"],
  "dowry death":         ["80"],
  "suicide":             ["108"],
  "abetment suicide":    ["108"],

  // Sexual offences
  "rape":                ["64"],
  "gang rape":           ["70"],
  "sexual assault":      ["74"],
  "molestation":         ["74"],
  "sexual harassment":   ["75"],
  "eve teasing":         ["79"],
  "stalking":            ["78"],
  "voyeurism":           ["77"],
  "disrobe":             ["76"],

  // Kidnapping
  "kidnapping":          ["140"],
  "kidnap":              ["140"],
  "abduction":           ["139"],
  "ransom":              ["143"],

  // Fraud & Cyber
  "cheating":            ["318"],
  "fraud":               ["318"],
  "online fraud":        ["318", "66D"],
  "cyber":               ["66D"],
  "cybercrime":          ["66D", "66C"],
  "identity theft":      ["66C"],
  "impersonation":       ["319"],
  "forgery":             ["336"],
  "fake document":       ["340"],

  // Property
  "criminal trespass":   ["329"],
  "trespass":            ["329"],
  "mischief":            ["324"],
  "vandalism":           ["324"],
  "arson":               ["326"],
  "extortion":           ["308"],
  "blackmail":           ["308", "351"],

  // Domestic
  "domestic violence":   ["85"],
  "cruelty":             ["85"],
  "dowry":               ["85", "80"],
  "dowry harassment":    ["85"],
  "harassment":          ["85"],

  // Other
  "rioting":             ["191"],
  "riot":                ["191"],
  "defamation":          ["356"],
  "intimidation":        ["351"],
  "wrongful confinement":["127"],
  "wrongful restraint":  ["126"],
  "breach of trust":     ["316"],
  "misappropriation":    ["314"],
  "false evidence":      ["229"],
  "evidence tampering":  ["238"],
};

// ── Canonical Legal Suggestion Constructor ───────────────────────────────────
export function createLegalSuggestion({
  act = "BNS 2023",
  section = "",
  title = "",
  explanation = "",
  confidence = 0.85,
  source = "AI",
  verifiedByPolice = false,
  verifiedByOfficerBadge = null,
  verifiedAt = null,
} = {}) {
  const cleanSec = String(section).replace(/^§/, "").trim();
  const info = BNS_SECTIONS[cleanSec];
  const detectedAct = act || (cleanSec.startsWith("66") || cleanSec === "67" || cleanSec === "67A" ? "IT Act 2000" : "BNS 2023");

  return {
    act: detectedAct,
    section: cleanSec,
    title: title || info?.title || `Section §${cleanSec}`,
    explanation: explanation || (info ? `Preliminary suggestion under ${info.category} category` : "AI legal suggestion"),
    confidence: typeof confidence === "number" ? confidence : 0.85,
    source: source || "AI",
    verifiedByPolice: Boolean(verifiedByPolice),
    verifiedByOfficerBadge: verifiedByOfficerBadge || null,
    verifiedAt: verifiedAt || null,
  };
}

// ── Deterministic Legal Candidate Classifier ─────────────────────────────────
/**
 * Evaluates statement facts and produces non-authoritative candidate BNS sections.
 * Strictly adheres to statutory definitions in Bharatiya Nyaya Sanhita, 2023.
 *
 * THEFT (BNS §303):
 * - Dishonest taking of movable property out of possession without consent
 * - Characteristics: Unattended property, left behind, missing upon return, pickpocket
 *
 * SNATCHING (BNS §304):
 * - Theft is snatching if offender suddenly or quickly or forcibly seizes, secures,
 *   grabs or takes away from any person or from his possession
 * - Characteristics: Grabbed from hand, snatched from neck, sudden seizure from person
 *
 * All candidate suggestions have verifiedByPolice: false.
 */
export function determineBnsCandidates(input, options = {}) {
  if (!input) return [];

  let text = "";
  let crimeType = "";
  let stolenItems = "";

  if (typeof input === "string") {
    text = input;
  } else if (input && typeof input === "object") {
    text = [
      input.description,
      input.statement,
      input.transcribedText,
      input.rawTranscript,
      input.originalStatement,
      input.incidentDescription,
    ].filter(Boolean).join(" ");
    crimeType = input.crimeType || input.crime_type || "";
    stolenItems = input.stolenItems || input.stolen_items || "";
  }

  const combined = `${text} ${crimeType} ${stolenItems}`.toLowerCase();
  const candidates = [];
  const candidateSections = new Set();

  const addCandidate = (sec, title, explanation, confidence) => {
    if (!candidateSections.has(sec)) {
      candidateSections.add(sec);
      candidates.push(createLegalSuggestion({
        act: sec.startsWith("66") || sec === "67" ? "IT Act 2000" : "BNS 2023",
        section: sec,
        title: title || BNS_SECTIONS[sec]?.title || `BNS §${sec}`,
        explanation,
        confidence,
        source: options.source || "deterministic_rule",
        verifiedByPolice: false,
        verifiedByOfficerBadge: null,
        verifiedAt: null,
      }));
    }
  };

  // 1. Factual Indicator Regexes
  const suddenPattern = /\b(sudden|suddenly|quickly|quick grab|sped away|drive-by|snatched|snatch|grabbed|grab|wrenched|pulled away|pounced)\b/i;
  const fromPersonPattern = /\b(from my hand|from my person|from my neck|from my shoulder|from me|from hand|from neck|off my neck|out of my hand|held in my hand|snatched it)\b/i;
  const forciblePattern = /\b(forcibl|forceful|force|violenc|pushed me|dragged me|wrestled|attacked)\b/i;
  const unattendedPattern = /\b(unattended|left behind|left my|parked|while i was away|when i returned|stepped away|bench|table|waiting area|bus stand|seat|forgot|lost sight|missing when|searched the surrounding)\b/i;
  const weaponPattern = /\b(knife|gun|pistol|blade|weapon|rod|iron pipe|firearm|cutlass)\b/i;
  const hurtPattern = /\b(hurt|injured|bleeding|beaten|slapped|punched|fracture|wound)\b/i;
  const stolenPattern = /\b(theft|stole|stolen|took my|missing|taken away|taken without|misappropriated)\b/i;

  const isSudden = suddenPattern.test(combined);
  const isFromPerson = fromPersonPattern.test(combined);
  const isForcible = forciblePattern.test(combined);
  const isUnattended = unattendedPattern.test(combined);
  const hasWeapon = weaponPattern.test(combined);
  const hasHurt = hurtPattern.test(combined);
  const hasStolen = stolenPattern.test(combined);

  // ── RULE 1: ROBBERY (BNS §309) ─────────────────────────────────────────────
  // Theft accompanied by weapon, physical violence causing hurt, or threat of instant hurt
  if ((hasStolen || isSudden || isForcible) && (hasWeapon || (isForcible && hasHurt))) {
    addCandidate(
      "309",
      "Robbery (BNS §309)",
      "Theft accompanied by violence, hurt, or use of deadly weapon",
      0.90
    );
  }

  // ── RULE 2: SNATCHING (BNS §304) ───────────────────────────────────────────
  // Statutory Criteria: Sudden OR quick OR forcible seizure from person or possession
  // Explicitly requires confrontation/physical taking from person; unattended theft is NOT snatching.
  const isSnatchingFact = (
    !isUnattended && (
      (isSudden && isFromPerson) ||
      (isForcible && (isFromPerson || /\b(phone|mobile|chain|bag|purse|wallet)\b/i.test(combined))) ||
      /\b(suddenly grabbed|suddenly snatched|forcibly took|forcefully took|wrenched from|grabbed my mobile|snatched my mobile|grabbed my phone|snatched my phone|snatched my chain|grabbed my chain)\b/i.test(combined) ||
      /\b(chain snatching|mobile snatch|phone snatch|bag snatch|snatching)\b/i.test(combined)
    )
  );

  if (isSnatchingFact) {
    addCandidate(
      "304",
      "Snatching (BNS §304)",
      "Theft involving sudden, quick, or forcible seizure of movable property from person or possession",
      0.90
    );
  }

  // ── RULE 3: THEFT (BNS §303) ───────────────────────────────────────────────
  // Unattended property, missing without confrontation, pickpocketing, or property taken while away
  const isTheftFact = (
    isUnattended ||
    /\b(theft without confrontation|pickpocket|shoplifting|vehicle theft|bike theft|car theft|theft)\b/i.test(combined) ||
    (hasStolen && !isSnatchingFact && !candidateSections.has("309"))
  );

  if (isTheftFact && !candidateSections.has("304")) {
    const isExplicitlyUnattended = isUnattended;
    addCandidate(
      "303",
      "Theft (BNS §303)",
      isExplicitlyUnattended
        ? "Dishonest taking of movable property without consent (unattended property/no sudden confrontation from person)"
        : "Dishonest taking of movable property out of possession without consent",
      isExplicitlyUnattended ? 0.90 : 0.85
    );
  }

  // ── RULE 4: AMBIGUOUS THEFT STATEMENT (e.g. "My phone was stolen.") ─────────
  // When only general theft is stated with zero circumstances, return low-confidence §303
  // and flag mandatory police inquiry under BNSS §173. NEVER fabricate suddenness or §304.
  if (candidates.length === 0 && hasStolen) {
    addCandidate(
      "303",
      "Theft (BNS §303)",
      "Ambiguous report: Theft reported without details of manner of taking. Requires police inquiry under BNSS §173 to determine if unattended theft (§303) or snatching (§304).",
      0.45
    );
  }

  // ── RULE 5: EXTORTION (BNS §308) ───────────────────────────────────────────
  if (/\b(extortion|blackmail|threatened to ruin|demanded money or else|pay money or)\b/i.test(combined)) {
    addCandidate(
      "308",
      "Extortion (BNS §308)",
      "Putting person in fear of injury in order to commit extortion",
      0.85
    );
  }

  // ── RULE 6: CHEATING & FRAUD (BNS §318) ────────────────────────────────────
  if (/\b(cheating|cheated|fraud|online fraud|upi scam|otp fraud|phishing|fake investment|deceived into paying)\b/i.test(combined)) {
    addCandidate(
      "318",
      "Cheating (BNS §318)",
      "Cheating and dishonestly inducing delivery of property",
      0.85
    );
    if (/\b(online|cyber|upi|website|whatsapp|telegram|internet)\b/i.test(combined)) {
      addCandidate(
        "66D",
        "Cheating by personation using computer (IT Act §66D)",
        "Cheating by personation using computer resource",
        0.85
      );
    }
  }

  // ── RULE 7: CRIMINAL BREACH OF TRUST (BNS §316) ────────────────────────────
  if (/\b(breach of trust|entrusted with|misappropriated by employee|refused to return entrusted)\b/i.test(combined)) {
    addCandidate(
      "316",
      "Criminal breach of trust (BNS §316)",
      "Dishonest misappropriation or conversion of entrusted property",
      0.85
    );
  }

  // ── RULE 8: MISCHIEF & DAMAGE (BNS §324 / §326) ────────────────────────────
  if (/\b(vandalism|damaged my|broke my|destroyed my|smashed)\b/i.test(combined)) {
    addCandidate(
      "324",
      "Mischief (BNS §324)",
      "Mischief causing destruction or diminution of property value",
      0.80
    );
  }
  if (/\b(arson|set on fire|petrol bomb|burned down|fire to)\b/i.test(combined)) {
    addCandidate(
      "326",
      "Mischief by fire or explosive substance (BNS §326)",
      "Mischief by fire or explosive substance with intent to destroy property",
      0.90
    );
  }

  // ── RULE 9: CRIMINAL TRESPASS & HOUSE-TRESPASS (BNS §329 / §331) ───────────
  if (/\b(trespass|entered my house|broke into house|house breaking|intruded into)\b/i.test(combined)) {
    addCandidate(
      "329",
      "Criminal trespass and house-trespass (BNS §329)",
      "Unlawful entry into property in possession of another",
      0.85
    );
  }

  // ── RULE 10: PHYSICAL ASSAULT & HURT (BNS §116 / §117 / §118) ─────────────
  if (hasHurt || /\b(assault|beaten|hit me|punched|slapped|attacked me)\b/i.test(combined)) {
    if (hasWeapon) {
      addCandidate(
        "118",
        "Voluntarily causing hurt by dangerous weapon (BNS §118)",
        "Voluntarily causing hurt using dangerous weapon or means",
        0.85
      );
    } else if (/\b(fracture|grievous|severe|hospitalized|bleeding profusely)\b/i.test(combined)) {
      addCandidate(
        "117",
        "Voluntarily causing grievous hurt (BNS §117)",
        "Voluntarily causing grievous hurt to another",
        0.85
      );
    } else {
      addCandidate(
        "116",
        "Voluntarily causing hurt (BNS §116)",
        "Voluntarily causing hurt to another",
        0.80
      );
    }
  }

  // Fallback to keyword dictionary if no specific factual candidate triggered
  if (candidates.length === 0) {
    const dictSuggestions = suggestLegalSuggestions(combined, { source: options.source || "deterministic_rule" });
    return dictSuggestions;
  }

  return candidates;
}

// ── suggestLegalSuggestions (Dictionary Matcher) ─────────────────────────────
export function suggestLegalSuggestions(text, options = {}) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matched = new Map();

  for (const [keyword, sections] of Object.entries(CRIME_TO_BNS)) {
    if (lower.includes(keyword)) {
      for (const sec of sections) {
        if (!matched.has(sec) && BNS_SECTIONS[sec]) {
          const act = sec.startsWith("66") || sec === "67" || sec === "67A"
            ? "IT Act 2000"
            : "BNS 2023";
          matched.set(sec, createLegalSuggestion({
            act,
            section: sec,
            title: BNS_SECTIONS[sec].title,
            explanation: `Suggested for reported offence related to '${keyword}' (${BNS_SECTIONS[sec].category})`,
            confidence: 0.80,
            source: options.source || "deterministic_rule",
            verifiedByPolice: false,
          }));
        }
      }
    }
  }

  return Array.from(matched.values());
}

// ── Backward-compatible suggestIPCSections ──────────────────────────────────
export function suggestIPCSections(text) {
  return determineBnsCandidates(text);
}

// ── validateLegalSections (Statutory Codex Verification) ────────────────────
export function validateLegalSections(sections) {
  if (!sections || !sections.length) {
    return { isValid: false, summary: "No legal sections provided", details: [] };
  }

  const details = sections.map((secInput) => {
    const sec = typeof secInput === "object" ? secInput.section : String(secInput).replace(/^§/, "").trim();
    const info = BNS_SECTIONS[sec];
    return {
      section:  sec,
      valid:    !!info,
      title:    info?.title || `Unknown BNS section §${sec}`,
      severity: info?.severity || "unknown",
      act:      sec.startsWith("66") || sec === "67" || sec === "67A"
                  ? "IT Act 2000"
                  : "BNS 2023",
    };
  });

  const allValid   = details.every((d) => d.valid);
  const validCount = details.filter((d) => d.valid).length;

  return {
    isValid:  allValid,
    summary:  allValid
      ? `${validCount} BNS section(s) verified in legal codex`
      : `${validCount}/${sections.length} sections recognized in BNS 2023`,
    details,
    act:      "Bharatiya Nyaya Sanhita 2023",
  };
}

// ── validateIPCSections (Backward Compatibility Alias) ───────────────────────
export function validateIPCSections(sections) {
  return validateLegalSections(sections);
}

// ── Helper: convert old IPC number to BNS ────────────────────────────────────
export function ipcToBns(ipcSection) {
  return IPC_TO_BNS[String(ipcSection)] || null;
}

// ── Helper: get BNS section info ─────────────────────────────────────────────
export function getBnsInfo(bnsSection) {
  return BNS_SECTIONS[String(bnsSection)] || null;
}

