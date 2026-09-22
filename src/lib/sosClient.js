// src/lib/sosClient.js — Station-Aware Native & Realtime SOS Service
// Stage 6.3: Rebuild SOS Around Free Native + Realtime Architecture

import { supabase } from "./supabaseClient.js";
import {
  AUTHORIZED_SOS_RECIPIENTS,
  isAuthorizedRecipient,
  getStationShuffledRecipients,
  getStationCategorizedRecipients,
  buildCanonicalSosMessage,
} from "../config/sosRecipients.js";
import { loadFromStorage, saveToStorage } from "../utils/index.js";

export {
  getStationShuffledRecipients,
  getStationCategorizedRecipients,
  buildCanonicalSosMessage,
};

const LOCAL_SOS_KEY = "report_sos_local_records";

/**
 * Generates the standardized Google Maps URL for GPS coordinates.
 * @param {number|string} lat
 * @param {number|string} lng
 * @returns {string}
 */
export function buildMapsUrl(lat, lng) {
  const latStr = Number(lat).toFixed(5);
  const lngStr = Number(lng).toFixed(5);
  return `https://www.google.com/maps?q=${latStr},${lngStr}`;
}

/**
 * Builds the native emergency share message specified by Stage 6.3:
 *
 * SOS — immediate assistance requested.
 *
 * Time:
 * ...
 *
 * Location:
 * Google Maps URL
 *
 * GPS accuracy:
 * ...
 *
 * Nearest station:
 * ...
 *
 * @param {Object} params
 * @param {{ lat: number, lng: number, accuracy?: number }} params.location
 * @param {{ station_name?: string, station_code?: string, name?: string, code?: string, distance_km?: number }} [params.nearestStation]
 * @param {string} [params.timestamp]
 * @returns {string}
 */
export function buildNativeShareMessage({ location, nearestStation, timestamp }) {
  const timeStr = timestamp || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const lat = location?.lat || 0;
  const lng = location?.lng || 0;
  const mapsUrl = buildMapsUrl(lat, lng);
  const accuracyStr = location?.accuracy ? `±${Math.round(location.accuracy)}m` : "Unavailable";

  const stnName = nearestStation?.station_name || nearestStation?.name || "Nearest Station";
  const stnCode = nearestStation?.station_code || nearestStation?.code || "";
  const stnDist = nearestStation?.distance_km != null ? ` (${nearestStation.distance_km.toFixed(1)} km away)` : "";
  const stationStr = stnCode ? `${stnName} [${stnCode}]${stnDist}` : `${stnName}${stnDist}`;

  return [
    "SOS — immediate assistance requested.",
    "",
    "Time:",
    timeStr,
    "",
    "Location:",
    mapsUrl,
    "",
    "GPS accuracy:",
    accuracyStr,
    "",
    "Nearest station:",
    stationStr,
  ].join("\n");
}

// In-memory client-side idempotency set to prevent duplicate automatic dispatches
const clientDispatchedSosIds = new Set();

/**
 * Dispatches an automated server-side emergency SMS alert to the 3 primary contacts
 * via the Supabase Edge Function (httpSMS Android Gateway provider).
 *
 * @param {Object} params
 * @param {string} params.sosId - ID of the created SOS record
 * @param {string} params.stationCode - Jurisdictional police station code
 * @param {string} params.message - Complete canonical SOS message
 * @returns {Promise<Object>} Delivery response with state machine status
 */
export async function dispatchAutomaticSosSms({ sosId, stationCode, message }) {
  if (!sosId) {
    return {
      success: false,
      state: "SMS_PROVIDER_REJECTED",
      error: "sosId is required for automated SMS dispatch",
    };
  }

  // Client-side idempotency protection (Task 11)
  if (clientDispatchedSosIds.has(sosId)) {
    return {
      success: false,
      state: "SMS_PROVIDER_REJECTED",
      error: "Duplicate dispatch blocked: SOS alert already submitted for SMS delivery.",
    };
  }
  clientDispatchedSosIds.add(sosId);

  try {
    const { data, error } = await supabase.functions.invoke("send-sos-sms", {
      body: {
        sos_id: sosId,
        station_code: stationCode,
        message,
      },
    });

    if (error) {
      let parsedPayload = null;
      try {
        if (error.context && typeof error.context.json === "function") {
          parsedPayload = await error.context.json();
        } else if (error.context && typeof error.context.text === "function") {
          const text = await error.context.text();
          try {
            parsedPayload = JSON.parse(text);
          } catch {
            parsedPayload = { error: text };
          }
        }
      } catch (_) {}

      const resolvedState =
        parsedPayload?.state ||
        data?.state ||
        (error.context?.status === 503 ? "SMS_PROVIDER_NOT_CONFIGURED" : "SMS_PROVIDER_REJECTED");

      const rawMsg = parsedPayload?.error || data?.error || "";
      const isConfigError =
        resolvedState === "SMS_PROVIDER_NOT_CONFIGURED" ||
        rawMsg.includes("missing:") ||
        rawMsg.includes("not configured") ||
        error.context?.status === 503;

      const finalState = isConfigError ? "SMS_PROVIDER_NOT_CONFIGURED" : resolvedState;
      const finalError = rawMsg
        ? rawMsg
        : finalState === "SMS_PROVIDER_NOT_CONFIGURED"
        ? "httpSMS Android gateway not configured on server."
        : "httpSMS gateway rejected submission";

      return {
        success: false,
        state: finalState,
        error: finalError,
        details: parsedPayload || data,
      };
    }

    return (
      data || {
        success: true,
        state: "SMS_SUBMITTED",
        message: "SOS SMS submitted to 3 emergency contacts.",
      }
    );
  } catch (err) {
    let parsedPayload = null;
    try {
      if (err?.context && typeof err.context.json === "function") {
        parsedPayload = await err.context.json();
      }
    } catch (_) {}

    const resolvedState =
      parsedPayload?.state ||
      (err?.context?.status === 503 ? "SMS_PROVIDER_NOT_CONFIGURED" : "SMS_PROVIDER_REJECTED");

    const rawMsg = parsedPayload?.error || err?.message || "";
    const isConfigError =
      resolvedState === "SMS_PROVIDER_NOT_CONFIGURED" ||
      rawMsg.includes("missing:") ||
      rawMsg.includes("not configured") ||
      err?.context?.status === 503;

    const finalState = isConfigError ? "SMS_PROVIDER_NOT_CONFIGURED" : resolvedState;
    const finalError = rawMsg && !rawMsg.includes("non-2xx")
      ? rawMsg
      : finalState === "SMS_PROVIDER_NOT_CONFIGURED"
      ? "httpSMS Android gateway not configured on server."
      : "Network error dispatching automated SMS";

    return {
      success: false,
      state: finalState,
      error: finalError,
      details: parsedPayload,
    };
  }
}

/**
 * Generates an individual native `sms:+91...?body=...` URI.
 * Strictly verifies that the recipient belongs to the authorized whitelist.
 * (Retained for backwards-compatibility; Stage 6.6 uses server-side automated dispatch).
 *
 * @param {string} phone - Must be in AUTHORIZED_SOS_RECIPIENTS
 * @param {string} message - Emergency message content
 * @returns {string} sms URI
 */
export function buildNativeSmsUri(phone, message) {
  if (!isAuthorizedRecipient(phone)) {
    throw new Error(`Unauthorized SOS recipient: ${phone}. Recipient must be in authorized configuration.`);
  }
  const cleanPhone = phone.trim();
  const encodedBody = encodeURIComponent(message);
  return `sms:${cleanPhone}?body=${encodedBody}`;
}

/**
 * Constructs the canonical database payload for `sos_records`.
 *
 * @param {Object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {number} [params.accuracy]
 * @param {Object} [params.nearestStation]
 * @param {string} [params.message]
 * @param {string} [params.userId]
 * @returns {Object} Canonical SOS insert payload
 */
export function buildSOSInsertPayload({
  latitude,
  longitude,
  accuracy,
  nearestStation,
  message,
  userId = null,
  emergencyType = "OTHER_CRITICAL_EMERGENCY",
  priority = "HIGH",
  threatLevel = "ACTIVE_THREAT",
  victimStatus = "REQUIRES_ASSISTANCE",
  incidentFacts = {},
  incidentTimeline = [],
  source = "WEB_QUICKSHIELD",
  safetagDeviceId = null,
  safetagEventId = null,
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const mapsUrl = buildMapsUrl(lat, lng);
  const stnCode = (nearestStation?.station_code || nearestStation?.code || "ONLINE").trim().toUpperCase();
  const stnName = (nearestStation?.station_name || nearestStation?.name || "Jurisdictional Police").trim();

  return {
    user_id: userId,
    latitude: lat,
    longitude: lng,
    accuracy: accuracy ? Math.round(Number(accuracy)) : null,
    nearest_station_code: stnCode,
    nearest_station_name: stnName,
    maps_url: mapsUrl,
    message: message || "SOS — immediate assistance requested.",
    status: "active",
    emergency_type: emergencyType,
    priority,
    threat_level: threatLevel,
    victim_status: victimStatus,
    incident_facts: incidentFacts,
    incident_timeline: incidentTimeline,
    source,
    safetag_device_id: safetagDeviceId,
    safetag_event_id: safetagEventId,
  };
}

/**
 * Generates a cryptographically secure RFC 4122 v4 UUID.
 * Uses crypto.randomUUID() when available, falling back to crypto.getRandomValues().
 * Strictly never uses Math.random().
 *
 * @returns {string} RFC 4122 v4 UUID
 */
export function generateSecureUuid() {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // Set version to 0100 (v4)
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      // Set variant to 10xx (RFC 4122)
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    }
  }
  throw new Error("Cryptographically secure random source (Web Crypto API) unavailable.");
}

/**
 * Creates an SOS record in Supabase `sos_records` with local storage fallback.
 * Returns record with truthful flags:
 * - `_supabase_inserted: true` and `_local_only: false` if database write succeeded
 * - `_supabase_inserted: false` and `_local_only: true` if database write failed
 *
 * @param {Object} params - see buildSOSInsertPayload
 * @returns {Promise<Object>} Created SOS record
 */
export async function createSOSRecord(params) {
  const payload = buildSOSInsertPayload(params);
  if (!payload.id) {
    try {
      payload.id = generateSecureUuid();
    } catch (_) {
      // Fall back to database gen_random_uuid() if crypto is completely unavailable
    }
  }

  // 1. Attempt Supabase insertion
  try {
    let isAuthed = false;
    let authUid = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      authUid = sessionData?.session?.user?.id || null;
      isAuthed = Boolean(authUid);
    } catch (_) {}

    if (isAuthed && authUid && !payload.user_id) {
      payload.user_id = authUid;
    }

    if (isAuthed) {
      const { data, error } = await supabase
        .from("sos_records")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.warn("Supabase SOS insert error, persisting to local store:", error.message);
      } else if (data) {
        const record = { ...data, _supabase_inserted: true, _local_only: false };
        const local = loadFromStorage(LOCAL_SOS_KEY, []);
        saveToStorage(LOCAL_SOS_KEY, [record, ...local.slice(0, 49)]);
        return record;
      }
    } else {
      // Anonymous insert: PostgREST .select() is not executed because anon cannot SELECT from sos_records
      const { error } = await supabase
        .from("sos_records")
        .insert(payload);

      if (error) {
        console.warn("Supabase anon SOS insert error, persisting to local store:", error.message);
      } else {
        const secureId = payload.id || generateSecureUuid();
        const createdRecord = {
          ...payload,
          id: secureId,
          created_at: new Date().toISOString(),
          acknowledged_at: null,
          resolved_at: null,
          _supabase_inserted: true,
          _local_only: false,
        };
        const local = loadFromStorage(LOCAL_SOS_KEY, []);
        saveToStorage(LOCAL_SOS_KEY, [createdRecord, ...local.slice(0, 49)]);
        return createdRecord;
      }
    }
  } catch (err) {
    console.warn("Network error during SOS creation, using local fallback:", err.message);
  }

  // Fallback: Local record with client-generated secure UUID
  const fallbackId = payload.id || generateSecureUuid();
  const fallbackRecord = {
    ...payload,
    id: fallbackId,
    created_at: new Date().toISOString(),
    acknowledged_at: null,
    resolved_at: null,
    _supabase_inserted: false,
    _local_only: true,
  };

  const local = loadFromStorage(LOCAL_SOS_KEY, []);
  saveToStorage(LOCAL_SOS_KEY, [fallbackRecord, ...local.slice(0, 49)]);
  return fallbackRecord;
}

/**
 * Fetches active and acknowledged SOS alerts for an authorized station.
 * Enforces station jurisdiction.
 *
 * @param {string} stationCode
 * @returns {Promise<Array<Object>>}
 */
export async function getStationSOSAlerts(stationCode) {
  if (!stationCode) return [];
  const cleanCode = stationCode.trim().toUpperCase();

  try {
    const { data, error } = await supabase
      .from("sos_records")
      .select("*")
      .eq("nearest_station_code", cleanCode)
      .in("status", ["active", "acknowledged"])
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Supabase getStationSOSAlerts error:", error.message);
    } else if (Array.isArray(data)) {
      return data;
    }
  } catch (err) {
    console.warn("Network error fetching station SOS:", err.message);
  }

  // Local storage fallback filtered by station
  const local = loadFromStorage(LOCAL_SOS_KEY, []);
  return local.filter(
    (r) =>
      (r.nearest_station_code || "").toUpperCase() === cleanCode &&
      ["active", "acknowledged"].includes(r.status)
  );
}

/**
 * Acknowledges an active SOS alert via secure RPC or guarded update.
 *
 * @param {string} sosId
 * @param {string} [officerBadge]
 * @returns {Promise<Object>}
 */
export async function acknowledgeSOS(sosId, officerBadge = "DUTY-OFFICER") {
  if (!sosId) throw new Error("SOS ID is required.");

  try {
    const { data, error } = await supabase.rpc("acknowledge_sos_secure", {
      p_sos_id: sosId,
      p_officer_badge: officerBadge,
    });

    if (!error && data?.success) {
      return data;
    }
  } catch (rpcErr) {
    console.warn("RPC acknowledge_sos_secure unavailable, attempting guarded update:", rpcErr.message);
  }

  // Fallback direct update guarded by RLS
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sos_records")
    .update({ status: "acknowledged", acknowledged_at: now })
    .eq("id", sosId)
    .select()
    .single();

  if (error) {
    // Update local cache if present
    const local = loadFromStorage(LOCAL_SOS_KEY, []);
    const updated = local.map((r) =>
      r.id === sosId ? { ...r, status: "acknowledged", acknowledged_at: now } : r
    );
    saveToStorage(LOCAL_SOS_KEY, updated);
    return { success: true, sos_id: sosId, status: "acknowledged", acknowledged_at: now };
  }

  return data;
}

/**
 * Resolves an SOS alert via secure RPC or guarded update.
 *
 * @param {string} sosId
 * @param {string} [officerNotes]
 * @returns {Promise<Object>}
 */
export async function resolveSOS(sosId, officerNotes = "") {
  if (!sosId) throw new Error("SOS ID is required.");

  try {
    const { data, error } = await supabase.rpc("resolve_sos_secure", {
      p_sos_id: sosId,
      p_officer_notes: officerNotes,
    });

    if (!error && data?.success) {
      return data;
    }
  } catch (rpcErr) {
    console.warn("RPC resolve_sos_secure unavailable, attempting guarded update:", rpcErr.message);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sos_records")
    .update({ status: "resolved", resolved_at: now })
    .eq("id", sosId)
    .select()
    .single();

  if (error) {
    const local = loadFromStorage(LOCAL_SOS_KEY, []);
    const updated = local.map((r) =>
      r.id === sosId ? { ...r, status: "resolved", resolved_at: now } : r
    );
    saveToStorage(LOCAL_SOS_KEY, updated);
    return { success: true, sos_id: sosId, status: "resolved", resolved_at: now };
  }

  return data;
}

/**
 * Subscribes police command terminal to real-time SOS alerts for their station.
 * Strictly filters by station code.
 *
 * @param {string} stationCode
 * @param {Function} onNewAlert
 * @param {Function} onStatusChange
 * @returns {Object} Subscription handle
 */
export function subscribeToStationSOS(stationCode, onNewAlert, onStatusChange) {
  if (!stationCode) return { unsubscribe: () => {} };
  const cleanCode = stationCode.trim().toUpperCase();

  const channel = supabase
    .channel(`station-sos-${cleanCode}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "sos_records",
      },
      (payload) => {
        const record = payload.new || payload.old;
        // Strict station jurisdiction defense-in-depth
        if ((record?.nearest_station_code || "").toUpperCase() !== cleanCode) {
          return;
        }

        if (payload.eventType === "INSERT") {
          onNewAlert?.(payload.new);
        } else if (payload.eventType === "UPDATE") {
          onStatusChange?.(payload.new);
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

/**
 * Subscribes a citizen to live updates for their active SOS record.
 * Enables instant transition to ACKNOWLEDGED or RESOLVED when police respond.
 *
 * @param {string} sosId
 * @param {Function} onUpdate
 * @returns {Object} Subscription handle
 */
export function subscribeToCitizenSOS(sosId, onUpdate) {
  if (!sosId) return { unsubscribe: () => {} };

  const channel = supabase
    .channel(`citizen-sos-${sosId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "sos_records",
        filter: `id=eq.${sosId}`,
      },
      (payload) => {
        if (payload.new && payload.new.id === sosId) {
          onUpdate?.(payload.new);
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}
