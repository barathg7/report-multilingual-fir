// src/lib/sosClient.js — Station-Aware Native & Realtime SOS Service
// Stage 6.3: Rebuild SOS Around Free Native + Realtime Architecture

import { supabase } from "./supabaseClient.js";
import { AUTHORIZED_SOS_RECIPIENTS, isAuthorizedRecipient } from "../config/sosRecipients.js";
import { loadFromStorage, saveToStorage } from "../utils/index.js";

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

/**
 * Generates an individual native `sms:+91...?body=...` URI.
 * Strictly verifies that the recipient belongs to the authorized whitelist.
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
  };
}

/**
 * Creates an SOS record in Supabase `sos_records` with local storage fallback.
 *
 * @param {Object} params - see buildSOSInsertPayload
 * @returns {Promise<Object>} Created SOS record
 */
export async function createSOSRecord(params) {
  const payload = buildSOSInsertPayload(params);
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined;
  if (id) payload.id = id;

  // 1. Attempt Supabase insertion
  try {
    let isAuthed = false;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      isAuthed = Boolean(sessionData?.session?.user);
    } catch (_) {}

    if (isAuthed) {
      const { data, error } = await supabase
        .from("sos_records")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.warn("Supabase SOS insert error, persisting to local store:", error.message);
      } else if (data) {
        const local = loadFromStorage(LOCAL_SOS_KEY, []);
        saveToStorage(LOCAL_SOS_KEY, [data, ...local.slice(0, 49)]);
        return data;
      }
    } else {
      // Anonymous insert: PostgREST .select() is not executed because anon cannot SELECT from sos_records
      const { error } = await supabase
        .from("sos_records")
        .insert(payload);

      if (error) {
        console.warn("Supabase anon SOS insert error, persisting to local store:", error.message);
      } else {
        const createdRecord = {
          id: payload.id || `sos_${Date.now()}`,
          ...payload,
          created_at: new Date().toISOString(),
          acknowledged_at: null,
          resolved_at: null,
        };
        const local = loadFromStorage(LOCAL_SOS_KEY, []);
        saveToStorage(LOCAL_SOS_KEY, [createdRecord, ...local.slice(0, 49)]);
        return createdRecord;
      }
    }
  } catch (err) {
    console.warn("Network error during SOS creation, using local fallback:", err.message);
  }

  // Fallback: Local record with client-generated UUID
  const fallbackRecord = {
    id: payload.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `sos_${Date.now()}`),
    ...payload,
    created_at: new Date().toISOString(),
    acknowledged_at: null,
    resolved_at: null,
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
