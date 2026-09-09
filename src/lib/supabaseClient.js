// src/lib/supabaseClient.js — Hardened Supabase Client & Secure RPC Interface
import { createClient } from "@supabase/supabase-js";
import { toSupabaseRow, normalizeFIR } from "./firSchema";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "⚠️ Supabase credentials missing!\n" +
      "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file."
  );
}

export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-key"
);

// ── Check duplicate FIR ──────────────────────────────────────────────────────
export async function checkDuplicateFIR(phone, incidentDate) {
  if (!phone || !incidentDate) return false;
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);

  try {
    const { data, error } = await supabase
      .from("firs")
      .select("id")
      .ilike("complainant_phone", `%${cleanPhone}%`)
      .eq("incident_date", incidentDate)
      .neq("status", "fake_fir")
      .limit(1);

    if (error) {
      console.warn("Supabase checkDuplicateFIR warning:", error.message);
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.warn("checkDuplicateFIR exception:", err.message);
    return false;
  }
}

// ── Save FIR (Citizen Insert with Initial Status Guard) ──────────────────────
export async function saveFIRToSupabase(fir) {
  const row = toSupabaseRow(fir);

  // Security check: Citizens cannot insert status other than 'draft' or 'submitted'
  if (row.status && !["draft", "submitted"].includes(row.status)) {
    throw new Error(`Unauthorized initial status: ${row.status}. Citizens may only file draft or submitted complaints.`);
  }

  const { data, error } = await supabase
    .from("firs")
    .upsert(row, { onConflict: "id" })
    .select();

  if (error) {
    console.error("❌ Supabase saveFIR error:", error.message);
    throw error;
  }

  return data;
}

// ── FIRs for Authorized Station (Strict Station Isolation) ───────────────────
export async function getFIRsForStation(stationCode) {
  if (!stationCode) return [];
  const cleanCode = stationCode.trim().toUpperCase();

  // Query station FIRs; backend RLS validates caller's station claim
  const { data, error } = await supabase
    .from("firs")
    .select("*")
    .eq("station_code", cleanCode)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("getFIRsForStation RLS notice:", error.message);
    throw error;
  }
  return (data || []).map(r => normalizeFIR(r));
}

// ── Secure FIR Status Mutation via RPC ───────────────────────────────────────
/**
 * Executes a server-guarded FIR status update via the update_fir_status_secure RPC.
 *
 * SECURITY (Phase 1.1):
 * - Authorization is derived server-side: auth.uid() -> police_officers table.
 * - The direct .update() fallback has been REMOVED. This function FAILS CLOSED.
 * - If the RPC is unavailable (migration not applied), a clear error is thrown.
 *   Do not attempt a direct .update() to work around this.
 */
export async function updateFIRStatusSecure(firId, newStatus, officerNotes = "") {
  if (!firId || !newStatus) {
    throw new Error("FIR ID and new status are required.");
  }

  const { data, error } = await supabase.rpc("update_fir_status_secure", {
    p_fir_id: firId,
    p_new_status: newStatus,
    p_officer_notes: officerNotes,
    // p_officer_badge intentionally omitted — server fetches it from police_officers table
  });

  if (error) {
    // Propagate server error directly (includes auth denied, illegal transition, FIR not found)
    if (error.message?.includes("does not exist") || error.message?.includes("404")) {
      throw new Error(
        "Status update failed: The secure RPC function is not installed on this Supabase instance. " +
        "Run supabase/migrations/20260908_phase1_1_security_rpc_v2.sql on your database before using the police portal."
      );
    }
    throw new Error(error.message || "Status update failed");
  }

  if (!data?.success) {
    throw new Error("Status update RPC returned unexpected response.");
  }

  return data;
}

// Legacy alias — routes to secure handler (no direct update fallback)
export async function updateFIRStatus(firId, newStatus) {
  return updateFIRStatusSecure(firId, newStatus);
}

/**
 * Verifies a legal section for an FIR via the secure server RPC.
 * Authorization is derived from auth.uid() -> police_officers on the server.
 */
export async function verifyLegalSectionSecure(firId, section, act = "BNS 2023") {
  if (!firId || !section) {
    throw new Error("FIR ID and section are required.");
  }

  const { data, error } = await supabase.rpc("verify_legal_section_secure", {
    p_fir_id: firId,
    p_section: section,
    p_act: act,
  });

  if (error) {
    if (error.message?.includes("does not exist") || error.message?.includes("404")) {
      throw new Error(
        "Legal verification failed: The secure RPC is not installed on this Supabase instance. " +
        "Run supabase/migrations/20260908_phase1_1_security_rpc_v2.sql on your database."
      );
    }
    throw new Error(error.message || "Legal section verification failed.");
  }

  return data;
}

// ── Citizen Receipt Lookup via Access Token ──────────────────────────────────
export async function getCitizenFIR(firId, accessToken) {
  if (!firId) return null;

  try {
    const query = supabase
      .from("firs")
      .select("*")
      .eq("id", firId);

    if (accessToken) {
      query.eq("access_token", accessToken);
    }

    const { data, error } = await query.single();
    if (error || !data) return null;
    return normalizeFIR(data);
  } catch {
    return null;
  }
}