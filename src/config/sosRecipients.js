// src/config/sosRecipients.js
// Centralized Authorized Emergency SOS Recipients for Demo/Testing Environment
// All numbers are strictly normalized to E.164 format (+91 followed by 10 digits).

export const AUTHORIZED_SOS_RECIPIENTS = Object.freeze([
  "+918428077014",
  "+916382586270",
  "+918122319636",
  "+919487304237",
  "+919047461987",
  "+916374763637",
]);

/**
 * Validates whether a phone number is one of the authorized emergency SOS recipients.
 * @param {string} phone
 * @returns {boolean}
 */
export function isAuthorizedRecipient(phone) {
  if (!phone || typeof phone !== "string") return false;
  return AUTHORIZED_SOS_RECIPIENTS.includes(phone.trim());
}

/**
 * Masks a phone number to reveal only country code and the last 4 digits.
 * Example: "+918428077014" -> "+91 ••••••7014"
 * @param {string} phone
 * @returns {string}
 */
export function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== "string") return "";
  const trimmed = phone.trim();
  if (trimmed.startsWith("+91") && trimmed.length === 13) {
    return `+91 ••••••${trimmed.slice(-4)}`;
  }
  if (trimmed.length > 4) {
    const last4 = trimmed.slice(-4);
    const prefix = trimmed.startsWith("+") ? trimmed.slice(0, 3) + " " : "";
    return `${prefix}••••••${last4}`;
  }
  return "••••";
}

/**
 * 32-bit FNV-1a hash algorithm for deterministic station hashing.
 * @param {string} str
 * @returns {number}
 */
export function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Mulberry32 32-bit PRNG for deterministic permutation generation.
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a station-specific deterministic shuffled ordering of the six authorized SOS numbers.
 * The shuffle is strictly deterministic from the station code, does not use Math.random(),
 * does not expose any additional numbers, rejects arbitrary user numbers,
 * and guarantees every station receives all 6 numbers.
 *
 * @param {string} stationCode
 * @returns {ReadonlyArray<string>} 6 shuffled authorized phone numbers
 */
export function getStationShuffledRecipients(stationCode) {
  const normalizedCode = (stationCode || "DEFAULT").trim().toUpperCase();
  const seedString = `${normalizedCode}:${AUTHORIZED_SOS_RECIPIENTS.join(",")}`;
  const seed = hashString(seedString);
  const prng = mulberry32(seed);

  const shuffled = [...AUTHORIZED_SOS_RECIPIENTS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return Object.freeze(shuffled);
}

/**
 * Partitions the deterministic station recipient ordering into:
 * - primary: first 3 contacts for emergency SMS actions
 * - backup: remaining 3 contacts configured as backup
 *
 * @param {string} stationCode
 * @returns {{ all: ReadonlyArray<string>, primary: ReadonlyArray<string>, backup: ReadonlyArray<string> }}
 */
export function getStationCategorizedRecipients(stationCode) {
  const ordered = getStationShuffledRecipients(stationCode);
  return {
    all: ordered,
    primary: Object.freeze(ordered.slice(0, 3)),
    backup: Object.freeze(ordered.slice(3, 6)),
  };
}

/**
 * Returns the 3 primary contacts for automated SOS SMS dispatch.
 * @param {string} stationCode
 * @returns {ReadonlyArray<string>}
 */
export function getStationPrimaryRecipients(stationCode) {
  return getStationCategorizedRecipients(stationCode).primary;
}

/**
 * Constructs the canonical automatic SOS alert message specified in Stage 6.5:
 *
 * 🚨 EMERGENCY SOS
 *
 * Immediate assistance requested.
 *
 * Time: <local time>
 *
 * Location:
 * https://www.google.com/maps?q=<lat>,<lng>
 *
 * GPS accuracy:
 * ±<accuracy>m
 *
 * Nearest police station:
 * <station name> (<station code>)
 *
 * Emergency assistance is required.
 * Call 112 for immediate emergency support.
 *
 * @param {Object} params
 * @param {{ lat: number, lng: number, accuracy?: number }} params.location
 * @param {{ station_name?: string, station_code?: string, name?: string, code?: string, distance_km?: number }} [params.nearestStation]
 * @param {string} [params.timestamp]
 * @returns {string}
 */
export function buildCanonicalSosMessage({ location, nearestStation, timestamp }) {
  const timeStr = timestamp || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const lat = location?.lat != null ? Number(location.lat).toFixed(5) : "0.00000";
  const lng = location?.lng != null ? Number(location.lng).toFixed(5) : "0.00000";
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const accuracyStr = location?.accuracy != null ? `±${Math.round(location.accuracy)}m` : "±10m";

  const stnName = (nearestStation?.station_name || nearestStation?.name || "Jurisdictional Police Station").trim();
  const stnCode = (nearestStation?.station_code || nearestStation?.code || "ONLINE").trim().toUpperCase();

  return [
    "🚨 EMERGENCY SOS",
    "",
    "Immediate assistance requested.",
    "",
    `Time: ${timeStr}`,
    "",
    "Location:",
    mapsUrl,
    "",
    "GPS accuracy:",
    accuracyStr,
    "",
    "Nearest police station:",
    `${stnName} (${stnCode})`,
    "",
    "Emergency assistance is required.",
    "Call 112 for immediate emergency support.",
  ].join("\n");
}

/**
 * Constructs the standardized SOS alert message containing all emergency context.
 * (Retained for backward-compatibility)
 *
 * @param {Object} params
 * @param {{ lat: number, lng: number, accuracy?: number }} params.location
 * @param {{ station_name: string, station_code: string, distance_km: number }} [params.nearestStation]
 * @param {string} [params.timestamp]
 * @returns {string}
 */
export function buildSosMessage({ location, nearestStation, timestamp }) {
  const timeStr = timestamp || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const latStr = Number(location.lat).toFixed(5);
  const lngStr = Number(location.lng).toFixed(5);
  const mapsUrl = `https://www.google.com/maps?q=${latStr},${lngStr}`;

  let msg = `🚨 SOS ALERT - Citizen Emergency Assistance Needed!\n`;
  msg += `Urgent assistance requested by citizen.\n`;
  if (nearestStation) {
    msg += `Nearest Station: ${nearestStation.station_name} (${nearestStation.station_code}) - ${nearestStation.distance_km.toFixed(1)} km away\n`;
  }
  msg += `Location: ${latStr}, ${lngStr}\n`;
  if (location.accuracy) {
    msg += `Accuracy: +/-${Math.round(location.accuracy)}m\n`;
  }
  msg += `Map: ${mapsUrl}\n`;
  msg += `Time: ${timeStr}`;

  return msg;
}
