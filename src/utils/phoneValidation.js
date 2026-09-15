// src/utils/phoneValidation.js
// Production Phone Normalization & E.164 Validation for SOS Dispatch

/**
 * Normalizes station phone numbers.
 * Returns null if the phone is:
 * - null, undefined, or not a string
 * - empty string or whitespace
 * - placeholder text ("Contact Unavailable", "Unavailable", "N/A", "None")
 * - missing any digits
 * Does NOT invent replacement numbers.
 */
export function normalizeStationPhone(rawPhone) {
  if (rawPhone == null) return null;
  if (typeof rawPhone !== "string") return null;
  const trimmed = rawPhone.trim();
  if (!trimmed) return null;
  if (/^contact\s+unavailable$/i.test(trimmed)) return null;
  if (/^unavailable$/i.test(trimmed) || /^none$/i.test(trimmed) || /^null$/i.test(trimmed) || /^n\/?a$/i.test(trimmed)) return null;
  if (!/\d/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Validates international E.164 phone numbers for SMS dispatch.
 * Must start with '+' followed by country code (1-9) and 7 to 14 digits (total 8-15 digits).
 */
export function isValidDispatchPhone(phone) {
  if (!phone || typeof phone !== "string") return false;
  return /^\+[1-9]\d{7,14}$/.test(phone.trim());
}

/**
 * Normalizes a raw station record (from Supabase or local dataset) into canonical shape.
 * Guarantees phonenumber is null if not configured or placeholder.
 */
export function normalizeStationRecord(s, distanceKm = 0) {
  const rawPhone = s.phone_number ?? s.phonenumber ?? s.phone ?? null;
  return {
    id:           s.id,
    station_code: s.station_code ?? s.code ?? s.id,
    station_name: s.station_name ?? s.name,
    district:     s.district ?? "",
    state:        s.state ?? "",
    lat:          Number(s.latitude ?? s.lat),
    lng:          Number(s.longitude ?? s.lng),
    radius_km:    Number(s.radius_km ?? 0),
    phonenumber:  normalizeStationPhone(rawPhone),
    distance_km:  distanceKm,
  };
}

export {
  AUTHORIZED_SOS_RECIPIENTS,
  isAuthorizedRecipient,
  maskPhoneNumber,
  buildSosMessage,
} from "../config/sosRecipients.js";
