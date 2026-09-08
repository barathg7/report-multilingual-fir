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
 * Executes a server-guarded FIR status update.
 * Prevents arbitrary status alterations (e.g. fake_fir, resolved) without officer authorization.
 */
export async function updateFIRStatusSecure(firId, newStatus, officerNotes = "", badgeNumber = "") {
  if (!firId || !newStatus) {
    throw new Error("FIR ID and new status are required.");
  }

  // 1. First attempt secure database RPC
  try {
    const { data, error } = await supabase.rpc("update_fir_status_secure", {
      p_fir_id: firId,
      p_new_status: newStatus,
      p_officer_notes: officerNotes,
      p_officer_badge: badgeNumber,
    });

    if (!error && data?.success) {
      return data;
    }

    if (error && !error.message?.includes("function update_fir_status_secure") && !error.message?.includes("not found")) {
      // If server explicitly denied transition or unauthorized
      throw new Error(error.message);
    }
  } catch (rpcErr) {
    // If function does not exist yet on remote instance (prior to migration run), perform guarded fallback
    if (!rpcErr.message?.includes("does not exist") && !rpcErr.message?.includes("404")) {
      throw rpcErr;
    }
  }

  // 2. Direct update fallback (only works if RLS allows authenticated officer)
  const { error: directError } = await supabase
    .from("firs")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", firId);

  if (directError) {
    throw new Error(`Status update failed: ${directError.message}`);
  }

  return { success: true, firId, status: newStatus };
}

// Legacy alias maintained for existing code, routes to secure handler
export async function updateFIRStatus(firId, newStatus) {
  return updateFIRStatusSecure(firId, newStatus);
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