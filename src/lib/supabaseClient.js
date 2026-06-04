// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "❌ Supabase credentials missing!\n" +
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

  try {
    const { data, error } = await supabase
      .from("firs")
      .select("id")
      .eq("complainant_phone", phone)
      .eq("incident_date", incidentDate)
      .neq("status", "fake_fir")
      .limit(1);

    if (error) {
      console.error("❌ checkDuplicateFIR error:", error.message);
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error("❌ checkDuplicateFIR exception:", err);
    return false;
  }
}

// ── Save FIR ─────────────────────────────────────────────────────────────────
export async function saveFIRToSupabase(fir) {
  const now = fir.createdAt || new Date().toISOString();

  const row = {
    id: fir.id,

    complainant_name: fir.complainantName || "",
    complainant_phone: fir.complainantPhone || "",
    complainant_age: fir.complainantAge || "",
    complainant_gender: fir.complainantGender || "",
    complainant_address: fir.complainantAddress || "",

    incident_date: fir.incidentDate || "",
    incident_time: fir.incidentTime || "",
    incident_location: fir.incidentLocation || "",
    incident_description: fir.incidentDescription || fir.transcribedText || "",
    crime_type: fir.crimeType || "",
    ipc_sections: fir.ipcSections?.length ? fir.ipcSections : [],

    suspect_description: fir.suspectDescription || "",
    stolen_items: fir.stolenItems || "",
    weapon_used: fir.weaponUsed || "",
    vehicle_number: fir.vehicleNumber || "",
    witness_names: fir.witnessNames || "",

    location_landmarks: fir.locationLandmarks || "",
    location_area: fir.locationArea || "",
    location_city: fir.locationCity || "",
    location_state: fir.locationState || "",
    location_postcode: fir.locationPostcode || "",
    incident_latitude:
      fir.incidentLatitude !== undefined &&
      fir.incidentLatitude !== null &&
      fir.incidentLatitude !== ""
        ? parseFloat(fir.incidentLatitude)
        : null,
    incident_longitude:
      fir.incidentLongitude !== undefined &&
      fir.incidentLongitude !== null &&
      fir.incidentLongitude !== ""
        ? parseFloat(fir.incidentLongitude)
        : null,
    location_address: fir.locationAddress || "",

    language: fir.language || "",
    transcribed_text: fir.transcribedText || "",
    evidence_photos: fir.evidencePhotos?.length ? fir.evidencePhotos : [],
    suspect_sketch_url: fir.suspectSketchUrl || fir.sketch?.url || "",

    station_id: fir.stationId || "",
    station_code: fir.stationCode || "",
    station_name: fir.stationName || "",
    selected_state: fir.selectedState || fir.locationState || "",

    status: fir.status || "submitted",
    saved_at: now,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("firs")
    .upsert(row, { onConflict: "id" })
    .select();

  if (error) {
    console.error("❌ Supabase saveFIR error:", error.message);
    throw error;
  }

  console.log("✅ FIR saved to Supabase:", fir.id);
  return data;
}

// ── FIRs for station ─────────────────────────────────────────────────────────
export async function getFIRsForStation(stationCode) {
  if (!stationCode) return [];

  const { data, error } = await supabase
    .from("firs")
    .select("*")
    .eq("station_code", stationCode)
    .order("saved_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

// ── All FIRs ─────────────────────────────────────────────────────────────────
export async function getAllFIRs() {
  const { data, error } = await supabase
    .from("firs")
    .select("*")
    .order("saved_at", { ascending: false });

  if (error) throw error;
  return data || [];
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
    radius_km: data.radius_km,
    phonenumber: data.phonenumber || "",
    password: data.password_hash,
  };
}