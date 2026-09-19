/**
 * src/lib/crisisIntelligence/emergencyTaxonomy.js
 *
 * Structured Emergency Taxonomy & Provenance Model for REPORT Universal Emergency System.
 *
 * CRITICAL ETHICAL & LEGAL SAFEGUARDS:
 * 1. AI must NEVER independently declare that someone is a "killer", "terrorist", or "criminal".
 *    Only structured factual incident categories are supported.
 * 2. UI wording uses neutral, precise emergency categories (e.g. ARMED_THREAT, not speculative labels).
 * 3. Every classification retains strict provenance:
 *    source, confidence, whether user-confirmed, timestamp, location, and accuracy.
 */

export const EMERGENCY_CATEGORIES = Object.freeze({
  IMMEDIATE_PHYSICAL_THREAT: "IMMEDIATE_PHYSICAL_THREAT",
  ARMED_THREAT: "ARMED_THREAT",
  HOSTAGE_OR_HOME_INVASION: "HOSTAGE_OR_HOME_INVASION",
  KIDNAPPING_OR_ABDUCTION: "KIDNAPPING_OR_ABDUCTION",
  DANGEROUS_PURSUIT: "DANGEROUS_PURSUIT",
  MEDICAL_EMERGENCY: "MEDICAL_EMERGENCY",
  FIRE_OR_DISASTER: "FIRE_OR_DISASTER",
  BOMB_OR_EXPLOSIVE_THREAT: "BOMB_OR_EXPLOSIVE_THREAT",
  SEXUAL_ASSAULT_OR_IMMEDIATE_DANGER: "SEXUAL_ASSAULT_OR_IMMEDIATE_DANGER",
  MISSING_OR_ENDANGERED_PERSON: "MISSING_OR_ENDANGERED_PERSON",
  OTHER_CRITICAL_EMERGENCY: "OTHER_CRITICAL_EMERGENCY",
});

export const THREAT_LEVELS = Object.freeze({
  UNKNOWN: "UNKNOWN",
  SUSPICIOUS_ACTIVITY: "SUSPICIOUS_ACTIVITY",
  ACTIVE_THREAT: "ACTIVE_THREAT",
  CRITICAL_THREAT: "CRITICAL_THREAT",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  RESOLVED: "RESOLVED",
});

export const INCIDENT_PRIORITY = Object.freeze({
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
});

export const PROVENANCE_SOURCES = Object.freeze({
  WEB_QUICKSHIELD: "WEB_QUICKSHIELD",
  SAFETAG_HARDWARE: "SAFETAG_HARDWARE",
  SAFETAG_BLE_SIMULATOR: "SAFETAG_BLE_SIMULATOR",
  UNIVERSAL_ACCESSIBLE: "UNIVERSAL_ACCESSIBLE",
  NO_COMMUNICATION_MODE: "NO_COMMUNICATION_MODE",
  ADAPTIVE_INTERVIEW: "ADAPTIVE_INTERVIEW",
  SIGN_LANGUAGE_EXPERIMENTAL: "SIGN_LANGUAGE_EXPERIMENTAL",
  POLICE_COMMAND: "POLICE_COMMAND",
});

export const EMERGENCY_TAXONOMY_METADATA = Object.freeze({
  [EMERGENCY_CATEGORIES.IMMEDIATE_PHYSICAL_THREAT]: {
    code: EMERGENCY_CATEGORIES.IMMEDIATE_PHYSICAL_THREAT,
    label: "Immediate Physical Threat",
    tamilLabel: "உடனடி உடல் ரீதியான அச்சுறுத்தல்",
    shortLabel: "Physical Threat",
    defaultThreatLevel: THREAT_LEVELS.CRITICAL_THREAT,
    defaultPriority: INCIDENT_PRIORITY.CRITICAL,
    color: "#dc2626", // Red-600
    icon: "ShieldAlert",
    requiresImmediateDispatch: true,
  },
  [EMERGENCY_CATEGORIES.ARMED_THREAT]: {
    code: EMERGENCY_CATEGORIES.ARMED_THREAT,
    label: "Armed Threat / Weapon Reported",
    tamilLabel: "ஆயுத அச்சுறுத்தல்",
    shortLabel: "Armed Threat",
    defaultThreatLevel: THREAT_LEVELS.CRITICAL_THREAT,
    defaultPriority: INCIDENT_PRIORITY.CRITICAL,
    color: "#b91c1c", // Red-700
    icon: "AlertTriangle",
    requiresImmediateDispatch: true,
  },
  [EMERGENCY_CATEGORIES.HOSTAGE_OR_HOME_INVASION]: {
    code: EMERGENCY_CATEGORIES.HOSTAGE_OR_HOME_INVASION,
    label: "Hostage / Home Invasion / Intrusion",
    tamilLabel: "பிணைக்கைதி / வீட்டுக்குள் அத்துமீறல்",
    shortLabel: "Hostage / Intrusion",
    defaultThreatLevel: THREAT_LEVELS.CRITICAL_THREAT,
    defaultPriority: INCIDENT_PRIORITY.CRITICAL,
    color: "#991b1b", // Red-800
    icon: "Home",
    requiresImmediateDispatch: true,
  },
  [EMERGENCY_CATEGORIES.KIDNAPPING_OR_ABDUCTION]: {
    code: EMERGENCY_CATEGORIES.KIDNAPPING_OR_ABDUCTION,
    label: "Kidnapping / Abduction in Progress",
    tamilLabel: "ஆட்கடத்தல் அச்சுறுத்தல்",
    shortLabel: "Abduction",
    defaultThreatLevel: THREAT_LEVELS.CRITICAL_THREAT,
    defaultPriority: INCIDENT_PRIORITY.CRITICAL,
    color: "#7f1d1d", // Red-900
    icon: "UserMinus",
    requiresImmediateDispatch: true,
  },
  [EMERGENCY_CATEGORIES.DANGEROUS_PURSUIT]: {
    code: EMERGENCY_CATEGORIES.DANGEROUS_PURSUIT,
    label: "Dangerous Pursuit / Being Followed",
    tamilLabel: "பின்தொடரப்படுதல் / துரத்தல்",
    shortLabel: "Pursuit / Stalking",
    defaultThreatLevel: THREAT_LEVELS.ACTIVE_THREAT,
    defaultPriority: INCIDENT_PRIORITY.HIGH,
    color: "#ea580c", // Orange-600
    icon: "Footprints",
    requiresImmediateDispatch: true,
  },
  [EMERGENCY_CATEGORIES.MEDICAL_EMERGENCY]: {
    code: EMERGENCY_CATEGORIES.MEDICAL_EMERGENCY,
    label: "Medical Emergency / Severe Trauma",
    tamilLabel: "மருத்துவ அவசர நிலை",
    shortLabel: "Medical",
    defaultThreatLevel: THREAT_LEVELS.ACTIVE_THREAT,
    defaultPriority: INCIDENT_PRIORITY.HIGH,
    color: "#0284c7", // Sky-600
    icon: "Activity",
    requiresImmediateDispatch: true,
  },
  [EMERGENCY_CATEGORIES.FIRE_OR_DISASTER]: {
    code: EMERGENCY_CATEGORIES.FIRE_OR_DISASTER,
    label: "Fire or Critical Disaster",
    tamilLabel: "தீ அல்லது பேரிடர் அவசரம்",
    shortLabel: "Fire / Disaster",
    defaultThreatLevel: THREAT_LEVELS.CRITICAL_THREAT,
    defaultPriority: INCIDENT_PRIORITY.CRITICAL,
    color: "#d97706", // Amber-600
    icon: "Flame",
    requiresImmediateDispatch: true,
  },
  [EMERGENCY_CATEGORIES.BOMB_OR_EXPLOSIVE_THREAT]: {
    code: EMERGENCY_CATEGORIES.BOMB_OR_EXPLOSIVE_THREAT,
    label: "Explosive / Bomb Threat Reported",
    tamilLabel: "வெடிகுண்டு அச்சுறுத்தல்",
    shortLabel: "Explosive Threat",
    defaultThreatLevel: THREAT_LEVELS.CRITICAL_THREAT,
    defaultPriority: INCIDENT_PRIORITY.CRITICAL,
    color: "#4c0519", // Rose-950
    icon: "Bomb",
    requiresImmediateDispatch: true,
  },
  [EMERGENCY_CATEGORIES.SEXUAL_ASSAULT_OR_IMMEDIATE_DANGER]: {
    code: EMERGENCY_CATEGORIES.SEXUAL_ASSAULT_OR_IMMEDIATE_DANGER,
    label: "Sexual Assault / Immediate Danger",
    tamilLabel: "பாலியல் அச்சுறுத்தல் / உடனடி ஆபத்து",
    shortLabel: "Assault Danger",
    defaultThreatLevel: THREAT_LEVELS.CRITICAL_THREAT,
    defaultPriority: INCIDENT_PRIORITY.CRITICAL,
    color: "#c026d3", // Fuchsia-600
    icon: "HeartHandshake",
    requiresImmediateDispatch: true,
  },
  [EMERGENCY_CATEGORIES.MISSING_OR_ENDANGERED_PERSON]: {
    code: EMERGENCY_CATEGORIES.MISSING_OR_ENDANGERED_PERSON,
    label: "Missing / Endangered Person",
    tamilLabel: "காணாமல் போன / ஆபத்திலுள்ள நபர்",
    shortLabel: "Missing Person",
    defaultThreatLevel: THREAT_LEVELS.ACTIVE_THREAT,
    defaultPriority: INCIDENT_PRIORITY.HIGH,
    color: "#7c3aed", // Violet-600
    icon: "UserSearch",
    requiresImmediateDispatch: false,
  },
  [EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY]: {
    code: EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY,
    label: "Critical Emergency (General)",
    tamilLabel: "பொது அவசர உதவி",
    shortLabel: "General Emergency",
    defaultThreatLevel: THREAT_LEVELS.ACTIVE_THREAT,
    defaultPriority: INCIDENT_PRIORITY.HIGH,
    color: "#dc2626",
    icon: "Radio",
    requiresImmediateDispatch: true,
  },
});

/**
 * Validates whether a given key is a registered emergency category.
 * @param {string} category
 * @returns {boolean}
 */
export function isValidEmergencyCategory(category) {
  return Boolean(category && EMERGENCY_CATEGORIES[category]);
}

/**
 * Builds a standardized provenance record.
 * @param {Object} params
 * @param {string} params.source
 * @param {boolean} [params.userConfirmed=true]
 * @param {number} [params.confidence=1.0]
 * @param {Object} [params.location=null]
 * @param {string} [params.emergencyType]
 * @param {string} [params.threatLevel]
 * @returns {Object}
 */
export function buildProvenanceRecord({
  source = PROVENANCE_SOURCES.WEB_QUICKSHIELD,
  userConfirmed = true,
  confidence = 1.0,
  location = null,
  emergencyType = EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY,
  threatLevel = THREAT_LEVELS.ACTIVE_THREAT,
}) {
  return {
    source,
    user_confirmed: Boolean(userConfirmed),
    confidence: Math.max(0.0, Math.min(1.0, Number(confidence) || 1.0)),
    timestamp: new Date().toISOString(),
    location: location
      ? {
          lat: Number(location.lat),
          lng: Number(location.lng),
          accuracy: location.accuracy ? Math.round(Number(location.accuracy)) : null,
        }
      : null,
    emergency_type: emergencyType,
    threat_level: threatLevel,
  };
}

/**
 * Computes deterministic priority from explicit facts without AI speculation.
 * @param {string} emergencyType
 * @param {Object} facts
 * @returns {string} One of INCIDENT_PRIORITY
 */
export function computeDeterministicPriority(emergencyType, facts = {}) {
  const meta = EMERGENCY_TAXONOMY_METADATA[emergencyType] || EMERGENCY_TAXONOMY_METADATA.OTHER_CRITICAL_EMERGENCY;

  if (
    facts.weapon_visible === true ||
    facts.weapon_reported === true ||
    facts.suspects_count === "3+" ||
    facts.suspects_count >= 3 ||
    facts.immediate_physical_threat === true ||
    emergencyType === EMERGENCY_CATEGORIES.ARMED_THREAT ||
    emergencyType === EMERGENCY_CATEGORIES.BOMB_OR_EXPLOSIVE_THREAT ||
    emergencyType === EMERGENCY_CATEGORIES.HOSTAGE_OR_HOME_INVASION ||
    emergencyType === EMERGENCY_CATEGORIES.KIDNAPPING_OR_ABDUCTION ||
    emergencyType === EMERGENCY_CATEGORIES.IMMEDIATE_PHYSICAL_THREAT
  ) {
    return INCIDENT_PRIORITY.CRITICAL;
  }

  return meta.defaultPriority || INCIDENT_PRIORITY.HIGH;
}
