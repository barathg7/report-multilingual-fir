/**
 * bnsValidator.js
 *
 * Bharatiya Nyaya Sanhita (BNS) 2023 — effective July 1, 2024
 * Replaces Indian Penal Code (IPC) 1860
 *
 * Drop-in replacement for ipcValidator.js
 * Exports: suggestIPCSections, validateIPCSections
 * (kept same function names for backward compatibility)
 *
 * IPC → BNS mapping reference:
 *  IPC 302 → BNS 101 (Murder)
 *  IPC 379 → BNS 304 (Theft)
 *  IPC 392 → BNS 309B (Robbery)
 *  IPC 376 → BNS 64  (Rape)
 *  IPC 498A→ BNS 85  (Cruelty to wife)
 *  IPC 420 → BNS 319B (Cheating)
 */

// ── Complete BNS 2023 section database ────────────────────────────────────────
export const BNS_SECTIONS = {
  // Chapter V — Offences against women & children
  "63":  { title: "Rape — definition",                            category: "sexual",    severity: "high"   },
  "64":  { title: "Punishment for rape",                          category: "sexual",    severity: "high"   },
  "65":  { title: "Rape of woman under 12 years",                 category: "sexual",    severity: "high"   },
  "66":  { title: "Causing death or vegetative state during rape", category: "sexual",    severity: "high"   },
  "67":  { title: "Rape by husband — separation period",          category: "sexual",    severity: "high"   },
  "68":  { title: "Rape by person in authority",                  category: "sexual",    severity: "high"   },
  "69":  { title: "Sexual intercourse by deceit / false promise", category: "sexual",    severity: "medium" },
  "70":  { title: "Gang rape",                                    category: "sexual",    severity: "high"   },
  "71":  { title: "Repeat offenders — rape",                      category: "sexual",    severity: "high"   },
  "74":  { title: "Assault to outrage modesty of woman",          category: "sexual",    severity: "medium" },
  "75":  { title: "Sexual harassment",                            category: "sexual",    severity: "medium" },
  "76":  { title: "Assault with intent to disrobe woman",         category: "sexual",    severity: "medium" },
  "77":  { title: "Voyeurism",                                    category: "sexual",    severity: "medium" },
  "78":  { title: "Stalking",                                     category: "sexual",    severity: "medium" },
  "79":  { title: "Word or gesture to insult modesty of woman",   category: "sexual",    severity: "low"    },
  "80":  { title: "Dowry death",                                  category: "homicide",  severity: "high"   },
  "82":  { title: "Marrying again during lifetime of spouse",     category: "marriage",  severity: "medium" },
  "84":  { title: "Enticing or detaining married woman",          category: "marriage",  severity: "low"    },
  "85":  { title: "Cruelty by husband or relatives (Domestic Violence)", category: "domestic", severity: "medium" },
  "86":  { title: "Cruelty — definition",                         category: "domestic",  severity: "medium" },
  // Chapter VI — Offences against State
  "147": { title: "Sedition / Offence against State",             category: "state",     severity: "high"   },
  // Chapter VII — Public tranquility
  "189": { title: "Unlawful assembly",                            category: "public",    severity: "medium" },
  "191": { title: "Rioting",                                      category: "public",    severity: "medium" },
  "192": { title: "Rioting armed with deadly weapon",             category: "public",    severity: "high"   },
  "193": { title: "Every member of unlawful assembly guilty",     category: "public",    severity: "medium" },
  "196": { title: "Promoting enmity between groups",              category: "public",    severity: "medium" },
  // Chapter X — Contempt of lawful authority
  "221": { title: "Obstructing public servant in discharge of duty", category: "public", severity: "low"   },
  "229": { title: "Giving false evidence / perjury",              category: "justice",   severity: "medium" },
  "231": { title: "Punishment for false evidence",                category: "justice",   severity: "medium" },
  "238": { title: "Causing disappearance of evidence",            category: "justice",   severity: "medium" },
  // Chapter XI — Offences affecting human body
  "101": { title: "Murder",                                       category: "homicide",  severity: "high"   },
  "104": { title: "Culpable homicide not amounting to murder",    category: "homicide",  severity: "high"   },
  "105": { title: "Culpable homicide — punishment",               category: "homicide",  severity: "high"   },
  "106": { title: "Causing death by negligence",                  category: "homicide",  severity: "medium" },
  "108": { title: "Abetment of suicide",                          category: "homicide",  severity: "high"   },
  "109": { title: "Attempt to murder",                            category: "homicide",  severity: "high"   },
  "110": { title: "Attempt to commit culpable homicide",          category: "homicide",  severity: "high"   },
  "114": { title: "Hurt",                                         category: "assault",   severity: "low"    },
  "115": { title: "Grievous hurt",                                category: "assault",   severity: "medium" },
  "116": { title: "Voluntarily causing hurt — punishment",        category: "assault",   severity: "low"    },
  "117": { title: "Voluntarily causing grievous hurt — punishment", category: "assault", severity: "medium" },
  "118": { title: "Voluntarily causing hurt by dangerous weapon", category: "assault",   severity: "medium" },
  "119": { title: "Voluntarily causing grievous hurt by dangerous weapon", category: "assault", severity: "high" },
  "124": { title: "Voluntarily causing grievous hurt by acid attack", category: "assault", severity: "high" },
  "125": { title: "Attempt to throw acid",                        category: "assault",   severity: "high"   },
  "126": { title: "Wrongful restraint",                           category: "assault",   severity: "low"    },
  "127": { title: "Wrongful confinement",                         category: "assault",   severity: "medium" },
  "132": { title: "Causing hurt to deter public servant",         category: "assault",   severity: "medium" },
  // Kidnapping
  "137": { title: "Kidnapping",                                   category: "kidnap",    severity: "high"   },
  "138": { title: "Kidnapping from lawful guardianship",          category: "kidnap",    severity: "high"   },
  "139": { title: "Abduction",                                    category: "kidnap",    severity: "high"   },
  "140": { title: "Punishment for kidnapping",                    category: "kidnap",    severity: "high"   },
  "141": { title: "Kidnapping minor for begging",                 category: "kidnap",    severity: "high"   },
  "142": { title: "Kidnapping or abducting to murder",            category: "kidnap",    severity: "high"   },
  "143": { title: "Kidnapping for ransom",                        category: "kidnap",    severity: "high"   },
  "144": { title: "Kidnapping with intent to secretly confine",   category: "kidnap",    severity: "high"   },
  "145": { title: "Kidnapping woman to compel marriage",          category: "kidnap",    severity: "high"   },
  // Chapter XVII — Offences against property
  "303": { title: "Theft — definition",                           category: "property",  severity: "low"    },
  "304": { title: "Punishment for theft",                         category: "property",  severity: "medium" },
  "305": { title: "Theft in dwelling house",                      category: "property",  severity: "medium" },
  "306": { title: "Theft by clerk or servant",                    category: "property",  severity: "medium" },
  "308": { title: "Extortion — definition",                       category: "property",  severity: "medium" },
  "309": { title: "Punishment for extortion",                     category: "property",  severity: "medium" },
  "309B":{ title: "Punishment for robbery",                       category: "property",  severity: "high"   },
  "310B":{ title: "Punishment for dacoity",                       category: "property",  severity: "high"   },
  "311": { title: "Extortion by threat of death or grievous hurt", category: "property", severity: "high"   },
  "312": { title: "Attempt to commit robbery",                    category: "property",  severity: "high"   },
  "313": { title: "Voluntarily causing hurt in committing robbery", category: "property", severity: "high"  },
  "314": { title: "Preparation to commit dacoity",                category: "property",  severity: "high"   },
  "315": { title: "Belonging to gang of dacoits",                 category: "property",  severity: "high"   },
  "316": { title: "Dishonest misappropriation of property",       category: "property",  severity: "medium" },
  "316B":{ title: "Punishment for criminal breach of trust",      category: "property",  severity: "medium" },
  "316C":{ title: "Criminal breach of trust by public servant",   category: "property",  severity: "high"   },
  "318": { title: "Cheating — definition",                        category: "fraud",     severity: "medium" },
  "319": { title: "Punishment for cheating",                      category: "fraud",     severity: "medium" },
  "319A":{ title: "Punishment for cheating by personation",       category: "fraud",     severity: "medium" },
  "319B":{ title: "Cheating and inducing delivery of property",   category: "fraud",     severity: "medium" },
  "324": { title: "Mischief — definition",                        category: "property",  severity: "low"    },
  "324A":{ title: "Punishment for mischief",                      category: "property",  severity: "low"    },
  "325": { title: "Mischief causing damage to property",          category: "property",  severity: "medium" },
  "326": { title: "Mischief by fire or explosive substance",      category: "property",  severity: "high"   },
  "329": { title: "Criminal trespass — definition",               category: "property",  severity: "low"    },
  "329A":{ title: "Punishment for criminal trespass",             category: "property",  severity: "low"    },
  "330": { title: "House-trespass — definition",                  category: "property",  severity: "medium" },
  "330A":{ title: "Punishment for house-trespass",                category: "property",  severity: "medium" },
  "333": { title: "Lurking house-trespass to commit offence",     category: "property",  severity: "high"   },
  "336": { title: "Lurking house-trespass or house-breaking by night", category: "property", severity: "high" },
  // Chapter XVIII — Documents
  "336A":{ title: "Forgery",                                      category: "fraud",     severity: "medium" },
  "336B":{ title: "Forgery for purpose of cheating",             category: "fraud",     severity: "medium" },
  "336C":{ title: "Using forged document as genuine",             category: "fraud",     severity: "medium" },
  // Chapter XXI — Defamation & intimidation
  "351": { title: "Criminal intimidation — definition",           category: "intimidation", severity: "medium" },
  "351B":{ title: "Punishment for criminal intimidation",         category: "intimidation", severity: "medium" },
  "352": { title: "Intentional insult to provoke breach of peace", category: "intimidation", severity: "low" },
  "356": { title: "Defamation — definition",                      category: "reputation", severity: "low"   },
  // IT Act 2000 (unchanged — not replaced by BNS)
  "66C": { title: "IT Act §66C — Identity theft",                 category: "cyber",     severity: "medium" },
  "66D": { title: "IT Act §66D — Cheating by personation (computer)", category: "cyber", severity: "medium" },
  "66E": { title: "IT Act §66E — Violation of privacy",           category: "cyber",     severity: "medium" },
  "67":  { title: "IT Act §67 — Publishing obscene material online", category: "cyber",  severity: "high"   },
  "67A": { title: "IT Act §67A — Publishing sexually explicit material", category: "cyber", severity: "high" },
};

// ── IPC → BNS cross-reference (for backward compatibility) ────────────────────
export const IPC_TO_BNS = {
  "302": "101",  "304": "104",  "304A": "106", "304B": "80",
  "306": "108",  "307": "109",  "309": "226",
  "319": "114",  "320": "115",  "323": "116",  "324": "118",
  "325": "117",  "326": "119",  "326A": "124", "326B": "125",
  "340": "127",  "341": "126",  "354": "74",   "354A": "75",
  "354B": "76",  "354C": "77",  "354D": "78",
  "375": "63",   "376": "64",   "376A": "66",  "376D": "70",
  "378": "303",  "379": "304",  "380": "305",  "381": "306",
  "383": "308",  "384": "309",  "392": "309B", "393": "312",
  "395": "310B", "396": "311A", "403": "316",
  "405": "316A", "406": "316B", "409": "316C",
  "415": "318",  "417": "319",  "419": "319A", "420": "319B",
  "425": "324",  "426": "324A", "427": "325",
  "441": "329",  "447": "329A", "448": "330A",
  "465": "336A", "468": "336B", "471": "336C",
  "494": "82",   "498A": "85",
  "499": "356",  "503": "351",  "504": "352",  "506": "351B",
  "509": "79",
};

// ── Crime type → BNS sections mapping ────────────────────────────────────────
const CRIME_TO_BNS = {
  // Theft & Robbery
  "chain snatching":     ["309B", "304"],
  "chain snatch":        ["309B", "304"],
  "mobile snatch":       ["309B", "304"],
  "snatching":           ["309B", "304"],
  "robbery":             ["309B"],
  "armed robbery":       ["309B", "119"],
  "theft":               ["304"],
  "burglary":            ["330A", "304"],
  "house breaking":      ["336"],
  "shoplifting":         ["304"],
  "pickpocket":          ["304"],
  "vehicle theft":       ["304"],
  "bike theft":          ["304"],
  "car theft":           ["304"],
  "dacoity":             ["310B"],
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
  "cheating":            ["319B"],
  "fraud":               ["319B"],
  "online fraud":        ["319B", "66D"],
  "cyber":               ["66D"],
  "cybercrime":          ["66D", "66C"],
  "identity theft":      ["66C"],
  "impersonation":       ["319A"],
  "forgery":             ["336A"],
  "fake document":       ["336C"],
  // Property
  "criminal trespass":   ["329A"],
  "trespass":            ["329A"],
  "mischief":            ["324A"],
  "vandalism":           ["324A"],
  "arson":               ["326"],
  "extortion":           ["309"],
  "blackmail":           ["309", "351B"],
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
  "intimidation":        ["351B"],
  "wrongful confinement":["127"],
  "wrongful restraint":  ["126"],
  "breach of trust":     ["316B"],
  "misappropriation":    ["316"],
  "false evidence":      ["229"],
  "evidence tampering":  ["238"],
};

// ── suggestIPCSections (kept same name for backward compat) ───────────────────
export function suggestIPCSections(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matched = new Map();

  for (const [keyword, sections] of Object.entries(CRIME_TO_BNS)) {
    if (lower.includes(keyword)) {
      for (const sec of sections) {
        if (!matched.has(sec) && BNS_SECTIONS[sec]) {
          matched.set(sec, {
            section:  sec,
            title:    BNS_SECTIONS[sec].title,
            category: BNS_SECTIONS[sec].category,
            severity: BNS_SECTIONS[sec].severity,
            act:      sec.startsWith("66") || sec === "67" || sec === "67A"
                        ? "IT Act 2000"
                        : "BNS 2023",
          });
        }
      }
    }
  }

  // Sort: high severity first, then medium, then low
  const order = { high: 0, medium: 1, low: 2 };
  return [...matched.values()].sort(
    (a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
  );
}

// ── validateIPCSections (kept same name for backward compat) ──────────────────
export function validateIPCSections(sections) {
  if (!sections || !sections.length) {
    return { isValid: false, summary: "No sections provided", details: [] };
  }

  const details = sections.map((sec) => {
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
  const hasHigh    = details.some((d) => d.severity === "high");

  return {
    isValid:  allValid,
    summary:  allValid
      ? `${validCount} BNS section(s) verified — ${hasHigh ? "serious offence" : "registered"}`
      : `${validCount}/${sections.length} sections valid in BNS 2023`,
    details,
    act:      "Bharatiya Nyaya Sanhita 2023",
  };
}

// ── Helper: convert old IPC number to BNS ────────────────────────────────────
export function ipcToBns(ipcSection) {
  return IPC_TO_BNS[String(ipcSection)] || null;
}

// ── Helper: get BNS section info ─────────────────────────────────────────────
export function getBnsInfo(bnsSection) {
  return BNS_SECTIONS[String(bnsSection)] || null;
}
