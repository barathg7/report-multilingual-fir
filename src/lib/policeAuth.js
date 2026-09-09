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

import { supabase } from "./supabaseClient";
import { getStationByCode } from "@/utils/policeStations";

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

  // Reject known insecure demo password early
  if (typeof btoa === "function" && btoa(password) === "cG9saWNlMTIz") {
    throw new Error(
      "Default demonstration credentials are disabled. Contact your administrative nodal officer."
    );
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  // Verify station exists in local directory (fast pre-check, not authoritative for auth)
  const stationMeta = getStationByCode(cleanCode);
  if (!stationMeta) {
    throw new Error(
      `Station code ${cleanCode} is not recognised in the official jurisdiction directory.`
    );
  }

  // ── SERVER AUTHENTICATION ─────────────────────────────────────────────────
  // Email convention: TN-CHN-001 → tnCHN001@police.internal
  // Must match accounts created in the Supabase Auth dashboard / migration.
  const email = `${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, "")}@police.internal`;

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData?.user) {
    // Do not reveal which credential was wrong.
    throw new Error(
      "Authentication failed. Verify your station code and password, or contact your administrative nodal officer."
    );
  }

  const authUid = authData.user.id;

  // ── RETRIEVE STATION FROM SERVER ──────────────────────────────────────────
  // Station code comes from the police_officers table keyed by auth.uid().
  // The client cannot supply or forge this.
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

  // Verify station_code from server matches what officer entered
  if (officerRow.station_code.toUpperCase() !== cleanCode) {
    await supabase.auth.signOut();
    throw new Error(
      "Station assignment mismatch. Your credentials are not authorised for this station code."
    );
  }

  // ── CACHE DISPLAY DATA ONLY ───────────────────────────────────────────────
  // Used to render dashboard header (station name, district).
  // Authorization decisions are NEVER made from this cache.
  const displayCache = {
    stationCode: officerRow.station_code,
    stationName: stationMeta.name,
    district: stationMeta.district,
    state: stationMeta.state,
    officerBadge: officerRow.badge_number || officerBadge,
    officerName: officerRow.officer_name || "",
    rank: officerRow.rank || "",
    cachedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    _displayOnly: true,         // This cache MUST NOT be used for authorization
    _doNotTrustForAuth: true,
  };

  sessionStorage.setItem(SESSION_DISPLAY_KEY, JSON.stringify(displayCache));
  // Clear any legacy keys from the prior SHA-256 implementation
  sessionStorage.removeItem("police_auth_session");
  sessionStorage.removeItem("police_station");

  return {
    code: officerRow.station_code,
    name: stationMeta.name,
    district: stationMeta.district,
    state: stationMeta.state,
    officerBadge: officerRow.badge_number || officerBadge,
    officerName: officerRow.officer_name || "",
  };
}

/**
 * Returns the authenticated officer's station info for UI display.
 *
 * Authoritative source: supabase.auth.getSession() + police_officers DB query.
 * SessionStorage display cache is only returned if the Supabase session is still
 * live AND the cache has not expired — to avoid a DB round-trip on every render.
 *
 * If the Supabase session is gone (expired / signed out), returns null regardless
 * of what is in sessionStorage.
 */
export async function getAuthenticatedStation() {
  // Step 1: Require an active Supabase Auth session (server-issued JWT)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    await clearPoliceSession();
    return null;
  }

  // Step 2: Authoritative query — police_officers keyed by auth.uid() directly from Supabase
  // Station identity comes EXCLUSIVELY from the authenticated database record.
  // Tampering with localStorage or sessionStorage will NEVER change police identity.
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
    officerBadge: officerRow.badge_number || "DUTY-OFFICER",
    officerName: officerRow.officer_name || "",
    rank: officerRow.rank || "",
    authUid: session.user.id,
  };

  return verifiedIdentity;
}

/**
 * Signs the officer out and clears any display cache.
 * After this call, getAuthenticatedStation() returns null on subsequent calls.
 */
export async function clearPoliceSession() {
  try {
    await supabase.auth.signOut();
  } catch (_) {}
  try {
    sessionStorage.removeItem(SESSION_DISPLAY_KEY);
    sessionStorage.removeItem("police_auth_session");
    sessionStorage.removeItem("police_station");
  } catch (_) {}
}
