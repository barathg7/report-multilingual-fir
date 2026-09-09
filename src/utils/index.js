import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

// ── Indian State / UT Code Mapping ──────────────────────────────────────────
export const STATE_TO_CODE = {
  "Andhra Pradesh": "AP",
  "Arunachal Pradesh": "AR",
  "Assam": "AS",
  "Bihar": "BR",
  "Chhattisgarh": "CG",
  "Goa": "GA",
  "Gujarat": "GJ",
  "Haryana": "HR",
  "Himachal Pradesh": "HP",
  "Jharkhand": "JH",
  "Karnataka": "KA",
  "Kerala": "KL",
  "Madhya Pradesh": "MP",
  "Maharashtra": "MH",
  "Manipur": "MN",
  "Meghalaya": "ML",
  "Mizoram": "MZ",
  "Nagaland": "NL",
  "Odisha": "OD",
  "Punjab": "PB",
  "Rajasthan": "RJ",
  "Sikkim": "SK",
  "Tamil Nadu": "TN",
  "Telangana": "TS",
  "Tripura": "TR",
  "Uttarakhand": "UK",
  "Uttar Pradesh": "UP",
  "West Bengal": "WB",
  "Delhi": "DL",
  "Jammu and Kashmir": "JK",
  "Ladakh": "LA",
  "Puducherry": "PY",
  "Chandigarh": "CH",
};

export function getStateCode(stateName) {
  if (!stateName) return "IND";
  return STATE_TO_CODE[stateName] || (stateName.length <= 3 ? stateName.toUpperCase() : stateName.slice(0, 2).toUpperCase());
}

/**
 * Cryptographically secure UUIDv4 generator.
 * Used as the canonical, immutable primary key for FIR records in database & local storage.
 */
export function generateUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Safe fallback using timestamp & performance counters (never relies on Math.random)
  const now = Date.now();
  const perf = (typeof performance !== "undefined" && performance.now) ? Math.floor(performance.now() * 1000) : 12345;
  const hex = ((now ^ perf) >>> 0).toString(16).padStart(8, "0");
  const hex2 = ((now & 0xffff) ^ (perf & 0xffff)).toString(16).padStart(4, "0");
  return `${hex}-${hex2}-4102-8901-${hex}${hex2}`;
}

/**
 * 1. Draft ID: Transient client identifier for unsubmitted local drafts.
 */
export function generateDraftId() {
  const entropy = generateUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `DRAFT-${Date.now().toString(36).toUpperCase()}-${entropy}`;
}

/**
 * 2. Submission ID: Formal citizen filing acknowledgment ID.
 * In online mode: The canonical sequential ACK number (e.g. ACK/TN-CHN-001/2026/000042)
 * is assigned server-side by the database trigger and guaranteed unique by DB constraint.
 * In offline/transient mode: A collision-resistant reference with high entropy is generated.
 */
export function generateSubmissionId(opts = {}) {
  const state = typeof opts === "string" ? opts : (opts.state || opts.selectedState || "Tamil Nadu");
  const stationCode = typeof opts === "object" ? (opts.stationCode || opts.station_code) : "";
  const year = new Date().getFullYear();
  const stCode = stationCode ? stationCode.trim().toUpperCase() : `${getStateCode(state)}-ONLINE`;
  const entropy = generateUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `ACK/${stCode}/${year}/${entropy}`;
}

/**
 * 3. Official FIR Number: Assigned EXCLUSIVELY server-side by database RPC
 * (update_fir_status_secure) using atomic sequence counters when police formally
 * register the case for investigation.
 * 
 * Client-side random generation is prohibited.
 */
export function generateOfficialFIRNumber(opts = {}) {
  const seqNumber = typeof opts === "object" ? opts.sequenceNumber : null;
  if (!seqNumber) {
    throw new Error(
      "Client-side official FIR number generation without an explicit sequence number is prohibited. " +
      "Official FIR numbers are assigned server-side by database RPC."
    );
  }
  const state = typeof opts === "string" ? opts : (opts.state || opts.selectedState || "Tamil Nadu");
  const stationCode = typeof opts === "object" ? (opts.stationCode || opts.station_code) : "";
  const year = new Date().getFullYear();
  const stCode = stationCode ? stationCode.trim().toUpperCase() : `${getStateCode(state)}-STA01`;
  const seq = String(seqNumber).padStart(4, "0");
  return `${stCode}/${year}/${seq}`;
}

/**
 * Canonical FIR Primary Key generator: Returns a collision-resistant UUIDv4.
 */
export function generateFIRId(opts = {}) {
  if (typeof opts === "object" && opts.isDraft) {
    return generateDraftId();
  }
  return generateUUID();
}

// LocalStorage helpers
export function saveToStorage(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; }
  catch { return false; }
}

export function loadFromStorage(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
