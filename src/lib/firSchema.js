/**
 * src/lib/firSchema.js — Canonical FIR Data Model & Boundary Validation for REPORT v2
 * 
 * Provides:
 * - Canonical schema structure
 * - Safe normalization from AI, form, Supabase, and localStorage
 * - Boundary validation with actionable field errors and warnings
 * - Two-way mappers for Supabase and Document Generation
 */

export const FIR_STATUSES = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  VERIFIED: "verified",
  REQUIRES_CORRECTION: "requires_correction",
  CLOSED: "closed",
  FAKE_FIR: "fake_fir",
};

export const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  verified: "Verified",
  requires_correction: "Requires Correction",
  closed: "Closed",
  fake_fir: "⚠ Flagged as False Complaint",
};

export const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700 border-gray-300",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  under_review: "bg-amber-50 text-amber-700 border-amber-200",
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  requires_correction: "bg-orange-50 text-orange-700 border-orange-200",
  closed: "bg-slate-100 text-slate-700 border-slate-300",
  fake_fir: "bg-rose-50 text-rose-700 border-rose-200",
};

// generateOfficialFIRNumber is intentionally NOT imported here.
// Official FIR numbers are ONLY assigned server-side by the DB RPC
// (update_fir_status_secure) when police formally begin investigation.
// See: supabase/migrations/20260909_phase1_2_concurrency_and_counters.sql
import { generateSubmissionId, generateDraftId, generateUUID } from "../utils/index.js";

/**
 * Generates a citizen acknowledgment / reference ID for a new complaint submission.
 *
 * IMPORTANT: This is NOT an official FIR number.
 * - It is a reference for the citizen to track their complaint.
 * - An official FIR number (e.g. TN-CHN-001/2026/0042) is assigned ONLY
 *   by the database RPC when a police officer formally registers the complaint.
 * - The client MUST NOT display this as an "official FIR number".
 */
export function generateCanonicalFIRId(opts = {}) {
  return generateSubmissionId(opts);
}

/**
 * Creates a blank canonical FIR structure with an immutable UUID primary key.
 */
export function createDefaultFIR() {
  const now = new Date().toISOString();
  return {
    id: generateUUID(),
    draftId: generateDraftId(),
    submissionId: null,
    officialFIRNo: null,
    accessToken: null,
    status: FIR_STATUSES.DRAFT,
    complainant: {
      name: "",
      phone: "",
      email: "",
      age: "",
      gender: "",
      address: "",
      occupation: "",
    },
    incident: {
      date: "",
      time: "",
      crimeType: "",
      description: "",
      originalStatement: "",
      language: "English",
      languageCode: "en",
    },
    location: {
      address: "",
      area: "",
      city: "",
      state: "Tamil Nadu",
      postcode: "",
      landmarks: "",
      latitude: null,
      longitude: null,
      accuracy: null,
    },
    involved: {
      suspects: "",
      witnesses: "",
      victims: "",
    },
    evidence: {
      photos: [], // Array of string URLs (Base64 data or remote URLs, no transient blob URLs)
      stolenItems: "",
      weaponUsed: "",
      vehicleNumber: "",
      sketchUrl: "",
    },
    provenance: {}, // fieldName -> { source: 'USER'|'AI'|'GPS'|'SYSTEM'|'POLICE', confidence, editedByUser, verified, lastUpdated }
    legal: {
      legalSuggestions: [], // Canonical array of: { act, section, title, explanation, confidence, source, verifiedByPolice, verifiedByOfficerBadge, verifiedAt }
      suggestedSections: [], // BNS 2023 section codes
      ipcSections: [], // Legacy IPC equivalent sections for cross-reference
      verifiedSections: [],
      isVerifiedByPolice: false,
      legalCategory: "",
    },
    station: {
      id: null,
      code: "",
      name: "",
      district: "",
      state: "Tamil Nadu",
    },
    signature: {
      imageData: null,
      signedAt: null,
      signerName: "",
      signerRole: "Complainant",
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      savedAt: now,
      source: "web_portal",
      confidenceScore: null,
    },
  };
}

/**
 * Normalizes input from any source (form, Supabase flat row, AI output, or legacy storage)
 * into the Canonical FIR schema, while maintaining flat field aliases for backward compatibility.
 */
export function normalizeFIR(raw = {}) {
  const defaults = createDefaultFIR();
  if (!raw || typeof raw !== "object") return defaults;

  const complainant = {
    name: (raw.complainant?.name ?? raw.complainant_name ?? raw.complainantName ?? "").trim(),
    phone: (raw.complainant?.phone ?? raw.complainant_phone ?? raw.complainantPhone ?? "").trim(),
    email: (raw.complainant?.email ?? raw.complainant_email ?? raw.complainantEmail ?? "").trim(),
    age: String(raw.complainant?.age ?? raw.complainant_age ?? raw.complainantAge ?? "").trim(),
    gender: (raw.complainant?.gender ?? raw.complainant_gender ?? raw.complainantGender ?? "").trim(),
    address: (raw.complainant?.address ?? raw.complainant_address ?? raw.complainantAddress ?? "").trim(),
    occupation: (raw.complainant?.occupation ?? raw.complainant_occupation ?? raw.complainantOccupation ?? "").trim(),
  };

  const incident = {
    date: raw.incident?.date ?? raw.incident_date ?? raw.incidentDate ?? "",
    time: raw.incident?.time ?? raw.incident_time ?? raw.incidentTime ?? "",
    crimeType: (raw.incident?.crimeType ?? raw.crime_type ?? raw.crimeType ?? "").trim(),
    description: (raw.incident?.description ?? raw.incident_description ?? raw.incidentDescription ?? raw.transcribed_text ?? raw.transcribedText ?? "").trim(),
    originalStatement: (raw.incident?.originalStatement ?? raw.original_statement ?? raw.rawTranscript ?? "").trim(),
    language: raw.incident?.language ?? raw.language ?? "English",
    languageCode: raw.incident?.languageCode ?? raw.language_code ?? (typeof raw.language === "object" ? raw.language?.code : "en"),
  };

  const parseCoordinate = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  const location = {
    address: (raw.location?.address ?? raw.location_address ?? raw.locationAddress ?? raw.location?.displayName ?? "").trim(),
    area: (raw.location?.area ?? raw.location_area ?? raw.locationArea ?? "").trim(),
    city: (raw.location?.city ?? raw.location_city ?? raw.locationCity ?? raw.district ?? "").trim(),
    state: (raw.location?.state ?? raw.location_state ?? raw.locationState ?? raw.selected_state ?? raw.selectedState ?? "Tamil Nadu").trim(),
    postcode: (raw.location?.postcode ?? raw.location_postcode ?? raw.locationPostcode ?? "").trim(),
    landmarks: (raw.location?.landmarks ?? raw.location_landmarks ?? raw.locationLandmarks ?? raw.nearestLandmark ?? "").trim(),
    latitude: parseCoordinate(raw.location?.latitude ?? raw.incident_latitude ?? raw.incidentLatitude),
    longitude: parseCoordinate(raw.location?.longitude ?? raw.incident_longitude ?? raw.incidentLongitude),
    accuracy: parseCoordinate(raw.location?.accuracy),
  };

  const involved = {
    suspects: (raw.involved?.suspects ?? raw.suspect_description ?? raw.suspectDescription ?? "").trim(),
    witnesses: (raw.involved?.witnesses ?? raw.witness_names ?? raw.witnessNames ?? "").trim(),
    victims: (raw.involved?.victims ?? raw.victim_names ?? "").trim(),
  };

  const rawPhotos = raw.evidence?.photos ?? raw.evidence_photos ?? raw.evidencePhotos ?? [];
  const photos = Array.isArray(rawPhotos)
    ? rawPhotos.map(p => (typeof p === "string" ? p : p?.url || "")).filter(Boolean)
    : [];

  const evidence = {
    photos,
    stolenItems: Array.isArray(raw.evidence?.stolenItems ?? raw.stolen_items ?? raw.stolenItems)
      ? (raw.evidence?.stolenItems ?? raw.stolen_items ?? raw.stolenItems).filter(Boolean).map(s => String(s).trim()).join(", ")
      : String(raw.evidence?.stolenItems ?? raw.stolen_items ?? raw.stolenItems ?? "").trim(),
    weaponUsed: (raw.evidence?.weaponUsed ?? raw.weapon_used ?? raw.weaponUsed ?? "").trim(),
    vehicleNumber: (raw.evidence?.vehicleNumber ?? raw.vehicle_number ?? raw.vehicleNumber ?? "").trim(),
    sketchUrl: (raw.evidence?.sketchUrl ?? raw.suspect_sketch_url ?? raw.suspectSketchUrl ?? raw.sketch?.url ?? "").trim(),
  };

  const rawSuggestions = raw.legal?.legalSuggestions ?? raw.legal_suggestions ?? [];
  const rawSections = raw.legal?.suggestedSections ?? raw.bns_sections ?? raw.bnsSections ?? raw.ipc_sections ?? raw.ipcSections ?? [];

  let canonicalSuggestions = [];
  if (Array.isArray(rawSuggestions) && rawSuggestions.length > 0) {
    canonicalSuggestions = rawSuggestions.map(s => {
      if (typeof s === "object" && s.section) {
        const isOfficerAction = raw.status === "verified" || raw.status === "investigating";
        return {
          act: s.act || "BNS 2023",
          section: String(s.section).replace(/^§/, "").trim(),
          title: s.title || "",
          explanation: s.explanation || "",
          confidence: typeof s.confidence === "number" ? s.confidence : 0.85,
          source: s.source || "AI",
          verifiedByPolice: Boolean(s.verifiedByPolice) && isOfficerAction,
          verifiedByOfficerBadge: isOfficerAction ? (s.verifiedByOfficerBadge || null) : null,
          verifiedAt: isOfficerAction ? (s.verifiedAt || null) : null,
        };
      }
      return null;
    }).filter(Boolean);
  } else if (Array.isArray(rawSections) && rawSections.length > 0) {
    canonicalSuggestions = rawSections.map(sec => {
      const clean = String(sec).replace(/^§/, "").trim();
      return {
        act: "BNS 2023",
        section: clean,
        title: `BNS §${clean}`,
        explanation: "AI suggestion based on reported statement",
        confidence: 0.85,
        source: "AI",
        verifiedByPolice: false,
        verifiedByOfficerBadge: null,
        verifiedAt: null,
      };
    });
  }

  const sections = canonicalSuggestions.map(s => s.section);

  const isOfficerVerified = raw.status === "verified" || raw.status === "investigating";
  const legal = {
    legalSuggestions: canonicalSuggestions,
    suggestedSections: sections,
    ipcSections: sections,
    verifiedSections: isOfficerVerified && Array.isArray(raw.legal?.verifiedSections ?? raw.verified_sections)
      ? (raw.legal?.verifiedSections ?? raw.verified_sections)
      : [],
    isVerifiedByPolice: Boolean(raw.legal?.isVerifiedByPolice) && isOfficerVerified,
    legalCategory: raw.legal?.legalCategory ?? "",
  };

  const station = {
    id: raw.station?.id ?? raw.station_id ?? null,
    code: (raw.station?.code ?? raw.station_code ?? raw.stationCode ?? "").trim(),
    name: (raw.station?.name ?? raw.station_name ?? raw.stationName ?? "").trim(),
    district: (raw.station?.district ?? raw.station_district ?? location.city ?? "").trim(),
    state: (raw.station?.state ?? location.state ?? "Tamil Nadu").trim(),
  };

  const signature = {
    imageData: raw.signature?.imageData ?? raw.signature_image ?? null,
    signedAt: raw.signature?.signedAt ?? raw.signed_at ?? null,
    signerName: raw.signature?.signerName ?? complainant.name,
    signerRole: raw.signature?.signerRole ?? "Complainant",
  };

  const now = new Date().toISOString();
  const metadata = {
    createdAt: raw.metadata?.createdAt ?? raw.created_at ?? raw.createdAt ?? now,
    updatedAt: raw.metadata?.updatedAt ?? raw.updated_at ?? now,
    savedAt: raw.metadata?.savedAt ?? raw.saved_at ?? raw.savedAt ?? now,
    source: raw.metadata?.source ?? "web_portal",
    confidenceScore: typeof raw.confidence === "number" ? raw.confidence : (raw.metadata?.confidenceScore ?? null),
  };

  const canonical = {
    id: raw.id || defaults.id,
    draftId: raw.draftId || raw.draft_id || null,
    submissionId: raw.submissionId || raw.submission_id || null,
    officialFIRNo: raw.officialFIRNo || raw.official_fir_no || null,
    accessToken: raw.accessToken || raw.access_token || null,
    provenance: raw.provenance || {},
    status: Object.values(FIR_STATUSES).includes(raw.status) ? raw.status : FIR_STATUSES.SUBMITTED,
    complainant,
    incident,
    location,
    involved,
    evidence,
    legal,
    station,
    signature,
    metadata,

    // Backward-compatibility getters for legacy components
    get complainantName() { return this.complainant.name; },
    get complainantPhone() { return this.complainant.phone; },
    get complainantEmail() { return this.complainant.email; },
    get complainantAge() { return this.complainant.age; },
    get complainantGender() { return this.complainant.gender; },
    get complainantAddress() { return this.complainant.address; },

    get incidentDate() { return this.incident.date; },
    get incidentTime() { return this.incident.time; },
    get incidentLocation() { return this.location.address || this.location.city; },
    get incidentDescription() { return this.incident.description; },
    get crimeType() { return this.incident.crimeType; },
    get language() { return this.incident.language; },
    get transcribedText() { return this.incident.description; },

    get incidentLatitude() { return this.location.latitude; },
    get incidentLongitude() { return this.location.longitude; },
    get locationAddress() { return this.location.address; },
    get locationCity() { return this.location.city; },
    get locationState() { return this.location.state; },
    get locationArea() { return this.location.area; },
    get locationLandmarks() { return this.location.landmarks; },

    get suspectDescription() { return this.involved.suspects; },
    get witnessNames() { return this.involved.witnesses; },
    get stolenItems() { return this.evidence.stolenItems; },
    get weaponUsed() { return this.evidence.weaponUsed; },
    get vehicleNumber() { return this.evidence.vehicleNumber; },
    get suspectSketchUrl() { return this.evidence.sketchUrl; },
    get evidencePhotos() { return this.evidence.photos; },

    get ipcSections() { return this.legal.suggestedSections; },
    get bnsSections() { return this.legal.suggestedSections; },
    get stationCode() { return this.station.code; },
    get stationName() { return this.station.name; },
    get stationId() { return this.station.id; },
    get selectedState() { return this.location.state; },
    get createdAt() { return this.metadata.createdAt; },
    get savedAt() { return this.metadata.savedAt; },
  };

  return canonical;
}

/**
 * Strict boundary validation for FIR data before submission or DB writes.
 */
export function validateFIR(fir) {
  const errors = [];
  const warnings = [];
  const missingFields = [];

  const f = normalizeFIR(fir);

  // 1. Mandatory for legal complaint submission
  if (!f.complainant.name) {
    errors.push("Complainant name is required.");
    missingFields.push("complainant.name");
  }

  if (!f.complainant.phone) {
    errors.push("Complainant phone number is required.");
    missingFields.push("complainant.phone");
  } else if (!/^[6-9]\d{9}$/.test(f.complainant.phone.replace(/\D/g, "").slice(-10))) {
    warnings.push("Phone number format should be a valid 10-digit Indian mobile number.");
  }

  if (!f.incident.date) {
    errors.push("Incident date is required.");
    missingFields.push("incident.date");
  }

  if (!f.incident.description) {
    errors.push("Incident description or statement is required.");
    missingFields.push("incident.description");
  } else if (f.incident.description.length < 15) {
    warnings.push("Incident statement is brief. Additional details help police investigation.");
  }

  if (!f.incident.crimeType) {
    warnings.push("Crime category is unassigned. AI or officer classification will be needed.");
    missingFields.push("incident.crimeType");
  }

  if (!f.location.address && !f.location.city && (f.location.latitude === null)) {
    warnings.push("Approximate place or city of occurrence should be provided.");
    missingFields.push("location.city");
  }

  if (f.evidence.photos.some(p => typeof p === "string" && p.startsWith("blob:"))) {
    warnings.push("Some evidence items are temporary browser blobs and will need permanent storage.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    missingFields,
    completenessPercentage: calculateCompleteness(f),
  };
}

/**
 * Calculates a genuine, honest completeness score based on filled fields.
 * Never fabricates a 0.95 or fake number.
 */
export function calculateCompleteness(fir) {
  const f = normalizeFIR(fir);
  const checklist = [
    Boolean(f.complainant.name),
    Boolean(f.complainant.phone),
    Boolean(f.complainant.address),
    Boolean(f.incident.date),
    Boolean(f.incident.time),
    Boolean(f.incident.crimeType),
    Boolean(f.incident.description && f.incident.description.length >= 20),
    Boolean(f.location.city || f.location.address),
    Boolean(f.location.latitude !== null && f.location.longitude !== null),
    Boolean(f.legal.suggestedSections.length > 0),
    Boolean(f.signature.signedAt),
  ];
  const filled = checklist.filter(Boolean).length;
  return Math.round((filled / checklist.length) * 100);
}

/**
 * Transforms a canonical FIR into a safe, type-correct row for Supabase table `firs`
 */
export function toSupabaseRow(fir) {
  const f = normalizeFIR(fir);
  const now = f.metadata.updatedAt || new Date().toISOString();

  return {
    id: f.id,
    status: f.status,

    draft_id: f.draftId || null,
    submission_id: f.submissionId || null,
    official_fir_no: f.officialFIRNo || null,
    access_token: f.accessToken || null,
    provenance: f.provenance || {},

    complainant_name: f.complainant.name || null,
    complainant_phone: f.complainant.phone || null,
    complainant_email: f.complainant.email || null,
    complainant_age: f.complainant.age ? parseInt(f.complainant.age, 10) || null : null,
    complainant_gender: f.complainant.gender || null,
    complainant_address: f.complainant.address || null,

    incident_date: f.incident.date || null,
    incident_time: f.incident.time || null,
    incident_location: f.location.address || f.location.city || null,
    incident_description: f.incident.description || null,
    crime_type: f.incident.crimeType || null,
    legal_suggestions: f.legal.legalSuggestions || [],
    verified_sections: f.legal.verifiedSections || [],
    bns_sections: f.legal.suggestedSections || [],
    ipc_sections: f.legal.suggestedSections || [],

    suspect_description: f.involved.suspects || null,
    stolen_items: f.evidence.stolenItems || null,
    weapon_used: f.evidence.weaponUsed || null,
    vehicle_number: f.evidence.vehicleNumber || null,
    witness_names: f.involved.witnesses || null,

    location_landmarks: f.location.landmarks || null,
    location_area: f.location.area || null,
    location_city: f.location.city || null,
    location_state: f.location.state || null,
    location_postcode: f.location.postcode || null,
    incident_latitude: f.location.latitude,
    incident_longitude: f.location.longitude,
    location_address: f.location.address || null,

    language: f.incident.language || null,
    transcribed_text: f.incident.description || null,
    evidence_photos: f.evidence.photos,
    suspect_sketch_url: f.evidence.sketchUrl || null,

    // Ensure UUID fields are never empty strings
    station_id: f.station.id ? String(f.station.id) : null,
    station_code: f.station.code || null,
    station_name: f.station.name || null,
    selected_state: f.location.state || null,

    saved_at: f.metadata.savedAt || now,
    created_at: f.metadata.createdAt || now,
    updated_at: now,
  };
}

/**
 * Prepares payload for official state DOCX generation
 */
export function toDocxPayload(fir, stationOverride) {
  const f = normalizeFIR(fir);
  const stName = stationOverride?.name || f.station.name || "REPORT Digital FIR Station";
  const stDistrict = stationOverride?.district || f.location.city || "District Headquarter";

  return {
    id: f.id,
    complainantName: f.complainant.name,
    complainantPhone: f.complainant.phone,
    complainantAge: f.complainant.age,
    complainantGender: f.complainant.gender,
    complainantAddress: f.complainant.address,
    incidentDate: f.incident.date,
    incidentTime: f.incident.time,
    incidentLocation: f.location.address || f.location.city,
    incidentDescription: f.incident.description,
    crimeType: f.incident.crimeType,
    ipcSections: f.legal.suggestedSections,
    suspectDescription: f.involved.suspects,
    stolenItems: f.evidence.stolenItems,
    weaponUsed: f.evidence.weaponUsed,
    vehicleNumber: f.evidence.vehicleNumber,
    witnessNames: f.involved.witnesses,
    locationCity: f.location.city,
    locationState: f.location.state,
    locationAddress: f.location.address,
    district: stDistrict,
    policeStation: stName,
    incidentLatitude: f.location.latitude,
    incidentLongitude: f.location.longitude,
    createdDate: f.metadata.createdAt?.split("T")[0] || "",
    createdTime: f.metadata.createdAt ? new Date(f.metadata.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "",
  };
}
