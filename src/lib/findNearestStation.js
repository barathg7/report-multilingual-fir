// src/lib/findNearestStation.js
// FIXED: Queries BOTH Supabase AND local bundled dataset simultaneously,
// then returns the 3 nearest stations across both sources.
// This ensures local stations (which may not be in Supabase yet) are always found.

import { supabase } from "./supabaseClient";

function toRad(v) { return (v * Math.PI) / 180; }

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Normalize any station shape → unified object
function normalize(s, distanceKm) {
  return {
    id:           s.id,
    station_code: s.station_code ?? s.code ?? s.id,
    station_name: s.station_name ?? s.name,
    district:     s.district ?? "",
    state:        s.state ?? "",
    lat:          Number(s.latitude ?? s.lat),
    lng:          Number(s.longitude ?? s.lng),
    radius_km:    Number(s.radius_km ?? 0),
    phonenumber:  s.phone_number ?? s.phonenumber ?? s.phone ?? "",
    distance_km:  distanceKm,
  };
}

// Rank all stations by distance, return top N
function rankStations(stations, userLat, userLng, topN = 3) {
  const ranked = [];
  for (const s of stations) {
    const sLat = Number(s.latitude ?? s.lat);
    const sLng = Number(s.longitude ?? s.lng);
    if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) continue;
    ranked.push(normalize(s, haversineKm(userLat, userLng, sLat, sLng)));
  }
  ranked.sort((a, b) => a.distance_km - b.distance_km);
  return ranked.slice(0, topN);
}

// Deduplicate by station_code (prefer lower distance)
function dedupe(stations) {
  const seen = new Map();
  for (const s of stations) {
    const key = s.station_code;
    if (!seen.has(key) || seen.get(key).distance_km > s.distance_km) {
      seen.set(key, s);
    }
  }
  return [...seen.values()].sort((a, b) => a.distance_km - b.distance_km);
}

// ─── Main export: returns array of up to 3 nearest stations ──────────────────
export async function getNearestPoliceStations(userLat, userLng, topN = 3) {
  const lat = Number(userLat), lng = Number(userLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Invalid user coordinates");

  // Run Supabase query and local fallback IN PARALLEL
  const [supabaseStations, localStations] = await Promise.allSettled([
    // Source 1: Supabase
    supabase
      .from("police_stations")
      .select("id, station_code, station_name, district, state, latitude, longitude, radius_km, phone_number")
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      }),

    // Source 2: Bundled local JS dataset (always available, no network needed)
    import("../utils/policeStations.js").then(m => m.default || []),
  ]);

  const combined = [];

  if (supabaseStations.status === "fulfilled" && supabaseStations.value.length) {
    combined.push(...rankStations(supabaseStations.value, lat, lng, 20));
  } else {
    console.warn("Supabase stations unavailable:", supabaseStations.reason?.message);
  }

  if (localStations.status === "fulfilled" && localStations.value.length) {
    combined.push(...rankStations(localStations.value, lat, lng, 20));
  } else {
    console.warn("Local stations unavailable:", localStations.reason?.message);
  }

  if (!combined.length) return [];

  // Deduplicate and return top N
  const result = dedupe(combined).slice(0, topN);
  return result;
}

// Backward-compatible single-station export (returns nearest 1)
export async function getNearestPoliceStation(userLat, userLng) {
  const results = await getNearestPoliceStations(userLat, userLng, 1);
  return results[0] ?? null;
}