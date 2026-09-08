// src/lib/supabaseClient.js
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

// ── Save FIR ─────────────────────────────────────────────────────────────────
export async function saveFIRToSupabase(fir) {
  const row = toSupabaseRow(fir);

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

// ── FIRs for station ─────────────────────────────────────────────────────────
export async function getFIRsForStation(stationCode) {
  if (!stationCode) return [];

  const { data, error } = await supabase
    .from("firs")
    .select("*")
    .eq("station_code", stationCode)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(r => normalizeFIR(r));
}

// ── All FIRs ─────────────────────────────────────────────────────────────────
export async function getAllFIRs() {
  const { data, error } = await supabase
    .from("firs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(r => normalizeFIR(r));
}

// ── Update FIR status ────────────────────────────────────────────────────────
export async function updateFIRStatus(firId, newStatus) {
  const { error } = await supabase
    .from("firs")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", firId);

  if (error) throw error;
  return true;
}

// ── Verify police station login ──────────────────────────────────────────────
export async function verifyStationLogin(stationCode, password) {
  if (!stationCode || !password) return null;

  try {
    const { data, error } = await supabase
      .from("police_stations")
      .select(
        "id, station_code, station_name, district, state, latitude, longitude, radius_km, password_hash, phonenumber"
      )
      .eq("station_code", stationCode.toUpperCase())
      .single();

    if (error || !data) return null;
    if (data.password_hash !== password) return null;

    return {
      id: data.id,
      code: data.station_code,
      name: data.station_name,
      district: data.district,
      state: data.state,
      lat: data.latitude,
      lng: data.longitude,
      radius_km: data.radius_km || 15,
      phonenumber: data.phonenumber || "",
    };
  } catch {
    return null;
  }
}