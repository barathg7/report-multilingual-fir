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
 * 1. Draft ID: Transient client identifier for unsubmitted local drafts.
 */
export function generateDraftId() {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DRAFT-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

/**
 * 2. Submission ID: Formal citizen filing acknowledgment ID.
 * Dynamic by state and station — never hardcoded to TN001 for all states.
 */
export function generateSubmissionId(opts = {}) {
  const state = typeof opts === "string" ? opts : (opts.state || opts.selectedState || "Tamil Nadu");
  const stationCode = typeof opts === "object" ? (opts.stationCode || opts.station_code) : "";
  const year = new Date().getFullYear();
  const stCode = stationCode ? stationCode.trim().toUpperCase() : `${getStateCode(state)}-ONLINE`;
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `ACK/${stCode}/${year}/${seq}`;
}

/**
 * 3. Official FIR Number: Assigned upon formal police registration / investigation approval.
 */
export function generateOfficialFIRNumber(opts = {}) {
  const state = typeof opts === "string" ? opts : (opts.state || opts.selectedState || "Tamil Nadu");
  const stationCode = typeof opts === "object" ? (opts.stationCode || opts.station_code) : "";
  const seqNumber = typeof opts === "object" ? opts.sequenceNumber : null;
  const year = new Date().getFullYear();
  const stCode = stationCode ? stationCode.trim().toUpperCase() : `${getStateCode(state)}-STA01`;
  const seq = String(seqNumber || Math.floor(Math.random() * 9000) + 1000).padStart(4, "0");
  return `${stCode}/${year}/${seq}`;
}

/**
 * Dynamic FIR Reference ID generator (backward-compatible).
 * Uses jurisdictional state and station code; avoids hardcoded TN001 outside Tamil Nadu.
 */
export function generateFIRId(opts = {}) {
  if (typeof opts === "object" && opts.isDraft) {
    return generateDraftId();
  }
  return generateSubmissionId(opts);
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
