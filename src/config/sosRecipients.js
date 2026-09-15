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
 * Constructs the standardized SOS alert message containing all emergency context:
 * - SOS alert header
 * - Citizen emergency context
 * - Nearest police station details (if available)
 * - GPS latitude and longitude
 * - GPS accuracy (if available)
 * - Google Maps link
 * - Timestamp
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
