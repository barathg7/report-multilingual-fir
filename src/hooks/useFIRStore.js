// src/hooks/useFIRStore.js
// FIXES: ✅ sketch URL, ✅ station_code, ✅ evidence_photos as array, ✅ duplicate check
import { useState, useEffect, useCallback } from "react";
import { loadFromStorage, saveToStorage, generateFIRId } from "@/utils";
import { supabase, checkDuplicateFIR } from "@/lib/supabaseClient";

const STORE_KEY = "report_firs";

export function useFIRStore() {
  const [firs, setFirs]         = useState(() => loadFromStorage(STORE_KEY, []));
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const saveFIR = useCallback(async (data) => {
    const fir = { ...data, id: data.id || generateFIRId(), savedAt: new Date().toISOString(), status: data.status || "submitted" };

    setFirs((prev) => {
      const idx     = prev.findIndex((f) => f.id === fir.id);
      const updated = idx >= 0 ? prev.map((f, i) => i === idx ? fir : f) : [fir, ...prev];
      saveToStorage(STORE_KEY, updated);
      return updated;
    });

    if (fir.status !== "draft") {
      try {
        const row = {
          id: fir.id,
          complainant_name:     fir.complainantName      || null,
          complainant_phone:    fir.complainantPhone     || null,
          complainant_email:    fir.complainantEmail     || null,
          complainant_age:      fir.complainantAge       || null,
          complainant_gender:   fir.complainantGender    || null,
          complainant_address:  fir.complainantAddress   || null,
          incident_date:        fir.incidentDate         || null,
          incident_time:        fir.incidentTime         || null,
          incident_location:    fir.incidentLocation     || null,
          incident_description: fir.incidentDescription  || fir.transcribedText || null,
          crime_type:           fir.crimeType            || null,
          ipc_sections:         fir.ipcSections?.length  ? fir.ipcSections : [],
          suspect_description:  fir.suspectDescription   || null,
          stolen_items:         fir.stolenItems          || null,
          weapon_used:          fir.weaponUsed           || null,
          vehicle_number:       fir.vehicleNumber        || null,
          witness_names:        fir.witnessNames         || null,
          location_landmarks:   fir.locationLandmarks    || null,
          location_area:        fir.locationArea         || null,
          location_city:        fir.locationCity         || fir.location?.city      || null,
          location_state:       fir.locationState        || fir.location?.state     || null,
          location_postcode:    fir.locationPostcode     || fir.location?.postcode  || null,
          incident_latitude:    fir.incidentLatitude     || fir.location?.latitude  || null,
          incident_longitude:   fir.incidentLongitude    || fir.location?.longitude || null,
          location_address:     fir.locationAddress      || fir.location?.displayName || null,
          language:             fir.language             || null,
          transcribed_text:     fir.transcribedText      || fir.transcript || null,
          evidence_photos:      fir.evidencePhotos?.length ? fir.evidencePhotos : [],  // ✅ always array
          suspect_sketch_url:   fir.suspectSketchUrl     || fir.sketch?.url || null,   // ✅ sketch URL
          station_id:           fir.stationId            || null,                       // ✅ station
          station_code:         fir.stationCode          || null,                       // ✅ isolation key
          station_name:         fir.stationName          || null,
          selected_state:       fir.selectedState        || fir.locationState || fir.location?.state || null,
          status:               fir.status               || "submitted",
        };
        const { error } = await supabase.from("firs").upsert(row, { onConflict: "id" });
        if (error) console.warn("Supabase:", error.message);
        else console.log("✅ FIR saved:", fir.id);
      } catch (e) { console.warn("Offline:", e.message); }
    }
    return fir;
  }, []);

  // Check duplicate by phone + incident_date
  const checkDuplicate = useCallback(async (phone, incidentDate) => {
    const local = firs.find(f =>
      f.complainantPhone === phone && f.incidentDate === incidentDate &&
      f.status !== "fake_fir" && f.status !== "draft"
    );
    if (local) return { isDuplicate: true, existingId: local.id };
    try {
      return { isDuplicate: await checkDuplicateFIR(phone, incidentDate) };
    } catch { return { isDuplicate: false }; }
  }, [firs]);

  const deleteFIR = useCallback((id) => {
    setFirs((prev) => { const u = prev.filter(f => f.id !== id); saveToStorage(STORE_KEY, u); return u; });
  }, []);

  return { firs, saveFIR, deleteFIR, isOnline, pendingCount: firs.filter(f => f.status === "draft").length, checkDuplicate };
}