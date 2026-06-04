// src/components/kavalan/EmergencySecurity.jsx
// FIX: Edge Function expects { to, message } — was sending { to, body }

import React, { useEffect, useRef, useState, useCallback } from "react";
import { getNearestPoliceStations } from "../../lib/findNearestStation";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// FIX: send field as "message" (matches Edge Function body parsing)
async function sendSOSviaEdgeFunction(to, message) {
  const url = `${SUPABASE_URL}/functions/v1/send-sos-sms`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey":        SUPABASE_ANON_KEY,
      },
      // FIX: field is "message" not "body"
      body: JSON.stringify({ to, message }),
    });
  } catch (networkErr) {
    throw new Error("Network error — check your internet connection.");
  }
  let data = {};
  try {
    const text = await res.text();
    if (text.trim()) data = JSON.parse(text);
  } catch (_) {}
  if (!res.ok) throw new Error(data?.error || data?.message || `Edge Function error ${res.status}`);
  return data;
}

// Progressive GPS: coarse 8s → precise 25s
function getLocationProgressive(onProgress) {
  if (!navigator.geolocation) return Promise.reject(new Error("GPS_NOT_SUPPORTED"));
  return new Promise((resolve, reject) => {
    let done = false;
    onProgress?.("Detecting location (pass 1/2)…");
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (done) return; done = true; resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); },
      () => {
        if (done) return;
        onProgress?.("Switching to GPS (pass 2/2)…");
        navigator.geolocation.getCurrentPosition(
          (pos) => { if (done) return; done = true; resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); },
          (err) => { if (done) return; done = true; const M={1:"PERMISSION_DENIED",2:"POSITION_UNAVAILABLE",3:"TIMEOUT"}; reject(new Error(M[err.code]||"LOCATION_ERROR")); },
          { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  });
}

export default function EmergencySecurity({ showPanel = false, onClosePanel }) {
  const [sending,   setSending]   = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [status,    setStatus]    = useState("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [results,   setResults]   = useState([]);
  const [retryable, setRetryable] = useState(false);
  const [loc,       setLoc]       = useState(null);
  const audioCtxRef      = useRef(null);
  const alarmIntervalRef = useRef(null);

  useEffect(() => {
    if (!showPanel) { stopSiren(); setSosActive(false); setStatus("idle"); setStatusMsg(""); setResults([]); setSending(false); setRetryable(false); setLoc(null); }
  }, [showPanel]);
  useEffect(() => () => stopSiren(), []);

  function playSiren() {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current; let high = true; stopSiren();
      alarmIntervalRef.current = setInterval(() => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = "square"; osc.frequency.value = high ? 1100 : 750; gain.gain.value = 0.06;
        osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.35); high = !high;
      }, 500);
    } catch (e) { console.error("Audio:", e); }
  }
  function stopSiren() {
    if (alarmIntervalRef.current) { clearInterval(alarmIntervalRef.current); alarmIntervalRef.current = null; }
  }

  const sendSOS = useCallback(async () => {
    try {
      setSending(true); setResults([]); setRetryable(false); setStatus("sending"); setStatusMsg("Getting your live location…");

      const location = await getLocationProgressive((msg) => setStatusMsg(msg));
      setLoc(location);
      setSosActive(true); playSiren();
      if (navigator.vibrate) navigator.vibrate([500, 300, 500, 300, 700, 300]);

      setStatusMsg("Finding 3 nearest police stations…");
      const stations = await getNearestPoliceStations(location.lat, location.lng, 3);
      if (!stations.length) throw new Error("NO_STATION");

      const mapsUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
      const timeStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

      setStatusMsg(`Sending SOS to ${stations.length} nearest station${stations.length > 1 ? "s" : ""}…`);

      const smsPromises = stations.map(async (station, idx) => {
        // FIX: field name is "message" to match Edge Function
        const message =
          `🚨 SOS ALERT [${idx + 1}/${stations.length}] - Need immediate help!\n` +
          `Nearest Station: ${station.station_name} (${station.station_code})\n` +
          `Distance from victim: ${station.distance_km.toFixed(1)} km\n` +
          `Location: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}\n` +
          `Accuracy: +/-${Math.round(location.accuracy || 0)}m\n` +
          `Map: ${mapsUrl}\n` +
          `Time: ${timeStr}`;

        if (!station.phonenumber) return { station, sent: false, error: "No phone number" };

        try {
          await sendSOSviaEdgeFunction(station.phonenumber, message);
          return { station, sent: true, error: null };
        } catch (err) {
          return { station, sent: false, error: err.message };
        }
      });

      const smsResults = await Promise.all(smsPromises);
      setResults(smsResults);
      const sentCount = smsResults.filter(r => r.sent).length;

      stopSiren();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

      if (sentCount > 0) {
        setStatus("success");
        setStatusMsg(`SOS sent to ${sentCount} of ${stations.length} station${stations.length > 1 ? "s" : ""}`);
      } else {
        setStatus("error");
        setStatusMsg("SMS failed for all stations. Call 100 directly.");
        setRetryable(true);
      }

    } catch (err) {
      stopSiren();
      if (navigator.vibrate) navigator.vibrate(0);
      setSosActive(false); setStatus("error");
      const code = err?.message || "";
      if (code === "PERMISSION_DENIED") {
        setStatusMsg("Location access blocked.\n\nTo fix:\n1. Tap 🔒 in browser address bar\n2. Permissions → Location → Allow\n3. Phone Settings → Apps → Chrome → Location → Allow\n4. Tap Send SOS again");
        setRetryable(false);
      } else if (code === "GPS_NOT_SUPPORTED") {
        setStatusMsg("GPS not supported on this device.\nCall 100 directly."); setRetryable(false);
      } else if (code === "POSITION_UNAVAILABLE") {
        setStatusMsg("GPS signal unavailable.\nMove to an open area or near a window, then retry."); setRetryable(true);
      } else if (code === "TIMEOUT") {
        setStatusMsg("GPS is taking too long.\n\n• Ensure Location is ON in phone settings\n• Move near a window or step outside\n• Tap Retry — often works on 2nd attempt"); setRetryable(true);
      } else if (code === "NO_STATION") {
        setStatusMsg("No police stations found in database.\nCall 100 directly."); setRetryable(false);
      } else {
        setStatusMsg(`Error: ${code}\n\nCall 100 directly.`); setRetryable(true);
      }
    } finally {
      setSending(false);
    }
  }, []);

  function stopSOS() { stopSiren(); if (navigator.vibrate) navigator.vibrate(0); setSosActive(false); setStatus("idle"); setStatusMsg(""); }
  function closePanel() { stopSOS(); onClosePanel?.(); }

  if (!showPanel) return null;

  const BOX = {
    idle:    "bg-gray-50 border-gray-200 text-gray-600",
    sending: "bg-blue-50 border-blue-200 text-blue-700",
    success: "bg-green-50 border-green-200 text-green-800",
    error:   "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-red-700 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-wide">Emergency SOS</h2>
            <p className="text-red-200 text-xs mt-0.5">Sends GPS location to 3 nearest police stations</p>
          </div>
          <button onClick={closePanel} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white font-bold text-lg transition-colors">×</button>
        </div>

        <div className="p-5 space-y-4">
          {statusMsg && (
            <div className={`rounded-2xl border p-4 text-sm whitespace-pre-line leading-relaxed ${BOX[status]}`}>
              {status === "sending" && <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 align-middle" />}
              {statusMsg}
            </div>
          )}

          <div className="flex gap-3">
            {!sosActive ? (
              <button onClick={sendSOS} disabled={sending} className="flex-1 rounded-2xl bg-red-700 hover:bg-red-800 active:scale-95 text-white py-3.5 font-bold text-sm disabled:opacity-60 transition-all">
                {sending
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending…</span>
                  : "Send SOS"}
              </button>
            ) : (
              <button onClick={stopSOS} className="flex-1 rounded-2xl bg-gray-900 hover:bg-black active:scale-95 text-white py-3.5 font-bold text-sm transition-all">Stop Alarm</button>
            )}
            {retryable && !sending && (
              <button onClick={sendSOS} className="flex-1 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white py-3.5 font-bold text-sm transition-all">🔄 Retry</button>
            )}
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map(({ station, sent, error }, idx) => (
                <div key={station.station_code} className={`rounded-2xl border p-3.5 text-sm ${sent ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`font-bold text-sm ${sent ? "text-green-800" : "text-red-700"}`}>
                      {sent ? "✅" : "❌"} #{idx + 1} — {station.station_name}
                    </p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sent ? "bg-green-200 text-green-800" : "bg-red-200 text-red-700"}`}>
                      {station.distance_km.toFixed(1)} km
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{station.district} · {station.phonenumber || "No phone"}</p>
                  {error && <p className="text-xs text-red-600 mt-1">⚠️ {error}</p>}
                  {sent && loc && (
                    <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-xs text-green-700 underline">
                      View location on Maps →
                    </a>
                  )}
                </div>
              ))}
              {loc && <p className="text-center text-xs text-gray-400">📍 {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}{loc.accuracy ? ` (±${Math.round(loc.accuracy)} m)` : ""}</p>}
            </div>
          )}

          <p className="text-center text-gray-400 text-xs">If SMS fails, call <span className="font-bold text-gray-600">100</span> directly</p>
        </div>
      </div>
    </div>
  );
}