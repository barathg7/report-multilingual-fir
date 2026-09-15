// src/lib/policeAuth.js — Police Authentication via Supabase Auth
//
// SECURITY ARCHITECTURE (Phase 1.1):
// ─────────────────────────────────────────────────────────────────────────────
// Authentication relies EXCLUSIVELY on supabase.auth.signInWithPassword().
//
// Station identity is established server-side via:
//   auth.uid() → police_officers.auth_uid → police_officers.station_code
//
// The browser NEVER chooses, signs, or self-certifies:
//   - station_code
//   - officer role / badge
//   - any authorization claim
//
// sessionStorage is used ONLY as a UI display cache (station name / district for
// rendering the dashboard header). It is NEVER used for authorization decisions.
// All authorization happens server-side via Supabase RLS + police_officers table.
//
// PREVIOUS VULNERABILITY REMOVED:
//   The previous client-side signing salt shipped in the browser bundle
//   has been completely eliminated. The entire SHA-256 session-signing system is removed.
//
// DEPLOYMENT REQUIREMENT:
//   Police officers must be registered in:
//     1. auth.users  — via Supabase Auth (email: "<stationcode_no_dash>@police.internal")
//     2. public.police_officers — row with auth_uid, station_code, is_active = true
//   See: supabase/migrations/20260908_phase1_1_security_rpc_v2.sql
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabaseClient.js";
import { getStationByCode } from "../utils/policeStations.js";

const SESSION_DISPLAY_KEY = "police_display_cache";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8-hour duty shift

/**
 * Authenticates a police officer via Supabase Auth (server-side credential verification).
 *
 * Success chain:
 *   1. supabase.auth.signInWithPassword() — server validates credentials
 *   2. Query police_officers WHERE auth_uid = auth.uid() to retrieve station_code
 *   3. Validate station_code matches what the user entered
 *   4. Cache display data (station name / district) in sessionStorage for UI only
 *
 * If supabase.auth.signInWithPassword() fails → authentication denied, no fallback.
 */
export async function authenticatePolice(stationCode, password, officerBadge = "DUTY-OFFICER") {
  if (!stationCode || !password) {
    throw new Error("Station code and password are required.");
  }

  const cleanCode = stationCode.toUpperCase().trim();

  // Verify station exists in official directory
  const stationMeta = getStationByCode(cleanCode);
  if (!stationMeta) {
    throw new Error(
      `Station code ${cleanCode} is not recognised in the official jurisdiction directory.`
    );
  }

  // Reject compromised, legacy, or predictable password patterns immediately
  const lowerPwd = password.trim().toLowerCase();
  if (
    (typeof btoa === "function" && btoa(password) === "cG9saWNlMTIz") ||
    lowerPwd.startsWith("police@") ||
    lowerPwd.includes("-police@") ||
    lowerPwd.includes("police-secure") ||
    lowerPwd.includes("tn-police")
  ) {
    throw new Error(
      "Invalid credentials. Default, predictable, and revoked credentials are permanently disabled. Contact your jurisdictional nodal officer."
    );
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  // ── SERVER AUTHENTICATION VIA SUPABASE AUTH ─────────────────────────────────
  // Station credentials are NEVER verified on the client.
  // Station identity is determined EXCLUSIVELY by Supabase Auth + police_officers table.
  const email = `${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, "")}@police.internal`;

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData?.user) {
    throw new Error(
      "Authentication failed. Verify your station code and password, or contact your administrative nodal officer."
    );
  }

  const authUid = authData.user.id;

  // ── SERVER-DERIVED JURISDICTION & OFFICER RECORD ───────────────────────────
  // Query police_officers keyed strictly by auth.uid() — cannot be forged by client.
  const { data: officerRow, error: officerError } = await supabase
    .from("police_officers")
    .select("station_code, badge_number, officer_name, rank, is_active")
    .eq("auth_uid", authUid)
    .eq("is_active", true)
    .single();

  if (officerError || !officerRow) {
    await supabase.auth.signOut();
    throw new Error(
      "Your account is not linked to an active station. Contact your jurisdictional nodal officer to complete registration."
    );
  }

  // Verify station_code from server record matches what officer entered
  if (officerRow.station_code.toUpperCase() !== cleanCode) {
    await supabase.auth.signOut();
    throw new Error(
      "Station assignment mismatch. Your credentials are not authorised for this station code."
    );
  }

  // ── CACHE DISPLAY DATA ONLY (UI RENDERING ONLY) ───────────────────────────
  // Authorization decisions are NEVER made from this cache.
  const displayCache = {
    stationCode: officerRow.station_code,
    stationName: stationMeta.name,
    district: stationMeta.district,
    state: stationMeta.state,
    officerBadge: officerRow.badge_number || officerBadge || "SHO-DUTY",
    officerName: officerRow.officer_name || "",
    rank: officerRow.rank || "",
    cachedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    _displayOnly: true,
    _doNotTrustForAuth: true,
  };

  sessionStorage.setItem(SESSION_DISPLAY_KEY, JSON.stringify(displayCache));
  sessionStorage.removeItem("police_station_session");
  sessionStorage.removeItem("police_auth_session");
  sessionStorage.removeItem("police_station");

  return {
    code: officerRow.station_code,
    name: stationMeta.name,
    district: stationMeta.district,
    state: stationMeta.state,
    officerBadge: officerRow.badge_number || officerBadge || "SHO-DUTY",
    officerName: officerRow.officer_name || "",
  };
}

/**
 * Returns the authenticated officer's station info for UI display.
 * Authoritative source: supabase.auth.getSession() + police_officers DB query.
 * If the Supabase session is absent or expired, returns null immediately.
 */
export async function getAuthenticatedStation() {
  // Require an active Supabase Auth session (server-issued JWT)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    await clearPoliceSession();
    return null;
  }

  // Authoritative query: police_officers keyed by auth.uid()
  const { data: officerRow, error: officerError } = await supabase
    .from("police_officers")
    .select("station_code, badge_number, officer_name, rank, is_active")
    .eq("auth_uid", session.user.id)
    .eq("is_active", true)
    .single();

  if (officerError || !officerRow) {
    await clearPoliceSession();
    return null;
  }

  const stationMeta = getStationByCode(officerRow.station_code);

  const verifiedIdentity = {
    code: officerRow.station_code,
    name: stationMeta?.name || officerRow.station_code,
    district: stationMeta?.district || "",
    state: stationMeta?.state || "Tamil Nadu",
    officerBadge: officerRow.badge_number || "SHO-DUTY",
    officerName: officerRow.officer_name || "",
    rank: officerRow.rank || "",
    authUid: session.user.id,
  };

  return verifiedIdentity;
}

/**
 * Signs the officer out and clears all session storage.
 */
export async function clearPoliceSession() {
  try {
    await supabase.auth.signOut();
  } catch (_) {}
  try {
    sessionStorage.removeItem(SESSION_DISPLAY_KEY);
    sessionStorage.removeItem("police_station_session");
    sessionStorage.removeItem("police_auth_session");
    sessionStorage.removeItem("police_station");
  } catch (_) {}
}
