// src/components/kavalan/EmergencySecurity.jsx
// Stage 6.3: Station-Aware Native + Realtime SOS Architecture (3D HUD Design)

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Shield,
  Phone,
  Share2,
  MapPin,
  AlertTriangle,
  Radio,
  CheckCircle2,
  Volume2,
  VolumeX,
  X,
  Copy,
  ExternalLink,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { getNearestPoliceStations } from "../../lib/findNearestStation";
import {
  AUTHORIZED_SOS_RECIPIENTS,
  maskPhoneNumber,
  buildSosMessage,
} from "../../config/sosRecipients";
import {
  createSOSRecord,
  buildNativeShareMessage,
  buildNativeSmsUri,
  subscribeToCitizenSOS,
  buildMapsUrl,
} from "../../lib/sosClient";

// SOS State Machine Constants
const SOS_STATES = {
  IDLE: "IDLE",
  CONFIRM: "CONFIRM",
  ACQUIRING_GPS: "ACQUIRING GPS",
  GPS_READY: "GPS READY",
  SOS_ACTIVE: "SOS ACTIVE",
  POLICE_ALERTED: "POLICE ALERTED",
  SHARE_READY: "SHARE READY",
  SMS_UNAVAILABLE: "SMS UNAVAILABLE",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  RESOLVED: "RESOLVED",
  GPS_FAILURE: "GPS FAILURE",
  PERMISSION_DENIED: "PERMISSION DENIED",
  NETWORK_FAILURE: "NETWORK FAILURE",
};

export default function EmergencySecurity({ showPanel = false, onClosePanel }) {
  const [sosState, setSosState] = useState(SOS_STATES.IDLE);
  const [location, setLocation] = useState(null);
  const [nearestStation, setNearestStation] = useState(null);
  const [sosRecord, setSosRecord] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [copiedToast, setCopiedToast] = useState(false);
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  const [selectedRecipientIdx, setSelectedRecipientIdx] = useState(0);
  const [shareNotice, setShareNotice] = useState("");
  const [smsNotice, setSmsNotice] = useState("");
  const [openedSmsContacts, setOpenedSmsContacts] = useState({});

  const audioCtxRef = useRef(null);
  const sirenIntervalRef = useRef(null);
  const realtimeSubRef = useRef(null);
  const isMountedRef = useRef(true);

  // Stop siren audio oscillator
  const stopSiren = useCallback(() => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }
    setIsSirenPlaying(false);
  }, []);

  // Play high-low civic emergency siren via Web Audio API
  const playSiren = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      let isHigh = true;
      stopSiren();
      setIsSirenPlaying(true);

      sirenIntervalRef.current = setInterval(() => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(isHigh ? 960 : 720, ctx.currentTime);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
          isHigh = !isHigh;
        } catch (_) {}
      }, 500);
    } catch (e) {
      console.warn("Audio Context init error:", e);
    }
  }, [stopSiren]);

  // Clean reset when modal closes
  useEffect(() => {
    isMountedRef.current = true;
    if (!showPanel) {
      stopSiren();
      if (realtimeSubRef.current) {
        realtimeSubRef.current.unsubscribe();
        realtimeSubRef.current = null;
      }
      setSosState(SOS_STATES.IDLE);
      setLocation(null);
      setNearestStation(null);
      setSosRecord(null);
      setStatusMessage("");
      setCopiedToast(false);
      setShareNotice("");
      setSmsNotice("");
      setOpenedSmsContacts({});
    }
    return () => {
      isMountedRef.current = false;
      stopSiren();
      if (realtimeSubRef.current) {
        realtimeSubRef.current.unsubscribe();
      }
    };
  }, [showPanel, stopSiren]);

  // Progressive high-accuracy GPS acquisition
  const acquireGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setSosState(SOS_STATES.GPS_FAILURE);
      setStatusMessage("GPS hardware is not supported or accessible on this browser.");
      return;
    }

    setSosState(SOS_STATES.ACQUIRING_GPS);
    setStatusMessage("Locking high-accuracy GPS coordinates…");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMountedRef.current) return;
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setLocation(coords);
        setSosState(SOS_STATES.GPS_READY);
        setStatusMessage(`Coordinates acquired with ±${Math.round(coords.accuracy || 10)}m accuracy.`);
        dispatchEmergencyAlert(coords);
      },
      (err) => {
        if (!isMountedRef.current) return;
        if (err.code === 1) {
          // PERMISSION_DENIED
          setSosState(SOS_STATES.PERMISSION_DENIED);
          setStatusMessage("Location permission was denied. Tap 🔒 in address bar to allow location.");
        } else if (err.code === 2) {
          // POSITION_UNAVAILABLE
          setSosState(SOS_STATES.GPS_FAILURE);
          setStatusMessage("GPS satellite signal unavailable. Move to an open area or near a window.");
        } else {
          // TIMEOUT
          setSosState(SOS_STATES.GPS_FAILURE);
          setStatusMessage("GPS connection timed out. Tap retry to acquire location again.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  }, []);

  // Dispatch SOS: Identify nearest station, create Supabase SOS record, subscribe to police realtime
  const dispatchEmergencyAlert = useCallback(
    async (coords) => {
      let closestStation = null;
      try {
        const stations = await getNearestPoliceStations(coords.lat, coords.lng, 1);
        if (stations && stations.length > 0) {
          closestStation = stations[0];
          setNearestStation(closestStation);
        }
      } catch (stnErr) {
        console.warn("Nearest station calculation warning:", stnErr);
      }

      setSosState(SOS_STATES.SOS_ACTIVE);
      playSiren();
      if (navigator.vibrate) {
        navigator.vibrate([500, 250, 500, 250, 750]);
      }

      // Create Supabase record
      try {
        const record = await createSOSRecord({
          latitude: coords.lat,
          longitude: coords.lng,
          accuracy: coords.accuracy,
          nearestStation: closestStation,
          message: "SOS — immediate assistance requested.",
        });

        if (isMountedRef.current && record) {
          setSosRecord(record);
          if (!record._local_only && record._supabase_inserted !== false) {
            setSosState(SOS_STATES.POLICE_ALERTED);
            setStatusMessage("SOS alert sent to the jurisdictional police dashboard");

            // Subscribe to live status updates on this record
            if (record.id) {
              if (realtimeSubRef.current) realtimeSubRef.current.unsubscribe();
              realtimeSubRef.current = subscribeToCitizenSOS(record.id, (updated) => {
                if (!isMountedRef.current) return;
                if (updated.status === "acknowledged") {
                  setSosState(SOS_STATES.ACKNOWLEDGED);
                  setStatusMessage("Police Command acknowledged your SOS. Officers have been alerted.");
                  stopSiren();
                } else if (updated.status === "resolved") {
                  setSosState(SOS_STATES.RESOLVED);
                  setStatusMessage("Emergency incident marked resolved by station personnel.");
                  stopSiren();
                }
              });
            }
          } else {
            setSosState(SOS_STATES.NETWORK_FAILURE);
            setStatusMessage("Could not connect to police dashboard. SOS stored locally. Use Call 112 directly.");
          }
        }
      } catch (netErr) {
        console.warn("SOS creation network warning:", netErr);
        if (isMountedRef.current) {
          setSosState(SOS_STATES.NETWORK_FAILURE);
          setStatusMessage("Network failure connecting to command post. Use Call 112 or Share SOS directly.");
        }
      }
    },
    [playSiren, stopSiren]
  );

  // Native Web Share Action
  const handleNativeShare = useCallback(async () => {
    if (!location) return;

    const shareText = buildNativeShareMessage({
      location,
      nearestStation,
    });
    const mapsUrl = buildMapsUrl(location.lat, location.lng);

    if (navigator.share) {
      try {
        await navigator.share({
          title: "🚨 SOS Emergency Alert",
          text: shareText,
          url: mapsUrl,
        });
        setShareNotice("Share sheet opened. Delivery depends on the selected messaging app.");
        return;
      } catch (err) {
        // User cancelled share or share failed; fallback to clipboard
        if (err.name === "AbortError") return;
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(shareText);
      setShareNotice("Emergency alert copied to clipboard. Paste into your messaging app.");
      setCopiedToast(true);
      setTimeout(() => {
        if (isMountedRef.current) setCopiedToast(false);
      }, 3000);
    } catch (_) {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setShareNotice("Emergency alert copied to clipboard. Paste into your messaging app.");
      setCopiedToast(true);
      setTimeout(() => {
        if (isMountedRef.current) setCopiedToast(false);
      }, 3000);
    }
  }, [location, nearestStation]);

  if (!showPanel) return null;

  const currentRecipient = AUTHORIZED_SOS_RECIPIENTS[selectedRecipientIdx] || AUTHORIZED_SOS_RECIPIENTS[0];
  const mapsUrl = location ? buildMapsUrl(location.lat, location.lng) : null;
  const nativeShareMsg = location ? buildNativeShareMessage({ location, nearestStation }) : "";
  const nativeSmsUri = location ? buildNativeSmsUri(currentRecipient, nativeShareMsg) : null;

  const isEmergencyActive = [
    SOS_STATES.SOS_ACTIVE,
    SOS_STATES.POLICE_ALERTED,
    SOS_STATES.SHARE_READY,
    SOS_STATES.SMS_UNAVAILABLE,
    SOS_STATES.ACKNOWLEDGED,
  ].includes(sosState);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Emergency SOS Command Terminal"
      className="fixed inset-0 z-[9999] bg-[#070d1e]/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      {/* 3D Spatial Container with Civic Lighting */}
      <div className="relative w-full max-w-md rounded-3xl bg-[#0b132b] text-white border border-red-500/25 shadow-[0_25px_60px_-15px_rgba(220,38,38,0.35)] overflow-hidden flex flex-col my-auto transition-all duration-300">
        {/* Subtle Ambient Spatial Radial Glows */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* 3D Top Header Bar */}
        <div className="relative z-10 px-5 py-4 bg-gradient-to-b from-red-950/90 to-transparent border-b border-red-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-red-600/30 border border-red-500/40 shadow-inner">
              <Shield className="w-4 h-4 text-red-400" />
              {isEmergencyActive && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              )}
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide text-white flex items-center gap-2">
                EMERGENCY SOS
                <span className="text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded-full bg-red-600/30 border border-red-500/40 text-red-300 uppercase">
                  112 Direct
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Free Native + Realtime Architecture
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEmergencyActive && (
              <button
                type="button"
                onClick={() => (isSirenPlaying ? stopSiren() : playSiren())}
                aria-label={isSirenPlaying ? "Mute alarm siren" : "Play alarm siren"}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isSirenPlaying
                    ? "bg-red-600/40 border-red-500/60 text-red-200"
                    : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white"
                }`}
                title={isSirenPlaying ? "Mute Siren" : "Sound Siren"}
              >
                {isSirenPlaying ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stopSiren();
                onClosePanel?.();
              }}
              aria-label="Close emergency modal"
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="relative z-10 p-5 space-y-4">
          {/* Primary Action: Explicit Call 112 Directly (India Emergency Service) */}
          <div className="rounded-2xl bg-gradient-to-r from-red-700 via-red-600 to-rose-700 p-0.5 shadow-lg shadow-red-950/60">
            <a
              id="sos-call-112-button"
              href="tel:112"
              className="flex items-center justify-center gap-3 w-full py-3.5 px-4 rounded-[14px] bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-black tracking-wide text-base transition-all no-underline shadow-inner"
            >
              <Phone className="w-5 h-5 animate-pulse" />
              <span>📞 Call 112 Directly</span>
            </a>
          </div>
          <p className="text-[11px] text-center text-slate-400 font-medium -mt-2">
            Launches device dialer — call connection requires explicit action on your phone.
          </p>

          {/* 3D Dimensional Beacon & Radar Section */}
          <div className="flex flex-col items-center justify-center py-3">
            {/* Beacon Center */}
            <div className="relative flex items-center justify-center">
              {/* Pulsing radar rings during acquisition & active SOS */}
              {(sosState === SOS_STATES.ACQUIRING_GPS || isEmergencyActive) && (
                <>
                  <div className="absolute w-36 h-36 rounded-full border border-red-500/30 animate-ping opacity-60 pointer-events-none" />
                  <div className="absolute w-44 h-44 rounded-full border border-red-600/20 animate-pulse opacity-40 pointer-events-none" />
                </>
              )}

              {/* Beacon Button */}
              {sosState === SOS_STATES.IDLE && (
                <button
                  type="button"
                  id="sos-activate-button"
                  onClick={() => setSosState(SOS_STATES.CONFIRM)}
                  className="group relative w-28 h-28 rounded-full bg-gradient-to-b from-red-500 to-red-800 p-1 shadow-[0_10px_30px_rgba(220,38,38,0.5),inset_0_2px_4px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <div className="w-full h-full rounded-full bg-gradient-to-b from-red-600 to-red-900 border-2 border-red-400/50 flex flex-col items-center justify-center text-white shadow-inner">
                    <Radio className="w-7 h-7 text-white drop-shadow-md group-hover:scale-110 transition-transform" />
                    <span className="font-black text-xs tracking-wider mt-1">
                      PRESS SOS
                    </span>
                  </div>
                </button>
              )}

              {/* Confirm Prompt */}
              {sosState === SOS_STATES.CONFIRM && (
                <div className="text-center space-y-3 p-4 rounded-2xl bg-red-950/40 border border-red-500/30">
                  <div className="w-10 h-10 mx-auto rounded-full bg-red-600/30 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="font-bold text-sm text-white">
                    Broadcast Immediate Emergency Alert?
                  </h3>
                  <p className="text-xs text-slate-300 max-w-xs">
                    This will acquire high-accuracy GPS and alert the nearest police command post.
                  </p>
                  <div className="flex items-center gap-2 justify-center pt-1">
                    <button
                      type="button"
                      onClick={() => setSosState(SOS_STATES.IDLE)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      id="sos-confirm-broadcast-button"
                      onClick={acquireGPS}
                      className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-md shadow-red-600/40 cursor-pointer"
                    >
                      Confirm SOS
                    </button>
                  </div>
                </div>
              )}

              {/* Acquiring GPS State */}
              {sosState === SOS_STATES.ACQUIRING_GPS && (
                <div className="flex flex-col items-center justify-center p-4">
                  <div className="w-24 h-24 rounded-full border-4 border-red-500/20 border-t-red-500 animate-spin flex items-center justify-center mb-3">
                    <MapPin className="w-8 h-8 text-red-400 animate-pulse" />
                  </div>
                  <span className="text-xs font-bold text-red-300 tracking-wider">
                    ACQUIRING HIGH-ACCURACY GPS…
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Connecting to browser location sensors
                  </span>
                </div>
              )}

              {/* Active Emergency Beacon */}
              {isEmergencyActive && (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-red-600/20 border-2 border-red-500 flex flex-col items-center justify-center text-white shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                    <Radio className="w-8 h-8 text-red-400 animate-pulse" />
                    <span className="text-[10px] font-black tracking-widest text-red-300 mt-1">
                      ACTIVE
                    </span>
                  </div>
                </div>
              )}

              {/* Resolved State */}
              {sosState === SOS_STATES.RESOLVED && (
                <div className="flex flex-col items-center justify-center p-2">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center text-green-400 mb-2">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <span className="text-xs font-bold text-green-300">
                    EMERGENCY RESOLVED
                  </span>
                </div>
              )}

              {/* Error State Icon */}
              {[SOS_STATES.GPS_FAILURE, SOS_STATES.PERMISSION_DENIED, SOS_STATES.NETWORK_FAILURE].includes(sosState) && (
                <div className="flex flex-col items-center justify-center p-2">
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 mb-2">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <span className="text-xs font-bold text-amber-300">
                    {sosState}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Elevated Status Panel */}
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-4 space-y-2.5 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">State Machine Status:</span>
              <span
                id="sos-current-state-badge"
                className={`font-mono font-bold px-2 py-0.5 rounded-md text-[11px] ${
                  sosState === SOS_STATES.RESOLVED
                    ? "bg-green-500/20 text-green-300 border border-green-500/30"
                    : sosState === SOS_STATES.ACKNOWLEDGED
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : isEmergencyActive
                    ? "bg-red-500/20 text-red-300 border border-red-500/30"
                    : "bg-slate-800 text-slate-300 border border-slate-700"
                }`}
              >
                {sosState}
              </span>
            </div>

            {statusMessage && (
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {statusMessage}
              </p>
            )}

            {/* GPS Metrics */}
            {location && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-400" />
                  <span className="font-mono text-slate-300">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </span>
                  {location.accuracy && (
                    <span className="text-slate-500">
                      (±{Math.round(location.accuracy)}m)
                    </span>
                  )}
                </div>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                  >
                    <span>View Map</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {/* Nearest Police Station Info */}
            {nearestStation && (
              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-500">Nearest Station:</span>
                <span className="text-slate-300 font-medium text-right">
                  {nearestStation.station_name || nearestStation.name} (
                  {nearestStation.station_code || nearestStation.code})
                  {nearestStation.distance_km != null &&
                    ` · ${nearestStation.distance_km.toFixed(1)} km`}
                </span>
              </div>
            )}
          </div>

          {/* Action: Native Share SOS (Section 4) */}
          {location && (
            <div className="space-y-2">
              <button
                type="button"
                id="sos-native-share-button"
                onClick={handleNativeShare}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 border border-slate-600 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                <Share2 className="w-4 h-4 text-blue-400" />
                <span>{"Share SOS"}</span>
              </button>
              <p className="text-[10px] text-center text-slate-400">
                Broadcasts via phone share sheet or copies preformatted GPS alert to clipboard.
              </p>
              {shareNotice && (
                <p className="text-[11px] text-center text-blue-300 font-medium">
                  {shareNotice}
                </p>
              )}
              {copiedToast && (
                <p className="text-[11px] text-center text-green-400 font-bold animate-fade-in">
                  ✓ Emergency alert copied to clipboard. Paste into your messaging app.
                </p>
              )}
            </div>
          )}

          {/* AUTOMATIC POLICE ALERT (Section: Police Realtime Dispatch) */}
          {isEmergencyActive && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-2.5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black tracking-wider text-emerald-400 uppercase flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  AUTOMATIC POLICE ALERT
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {sosRecord && !sosRecord._local_only ? "Delivered to Dispatch" : "Connecting..."}
                </span>
              </div>

              <ul className="space-y-1.5 text-xs">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${sosRecord && !sosRecord._local_only ? "text-emerald-400" : "text-slate-500"}`} />
                  <span className={sosRecord && !sosRecord._local_only ? "font-semibold text-emerald-300" : "text-slate-400"}>
                    SOS alert delivered to police dashboard
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${location ? "text-emerald-400" : "text-slate-500"}`} />
                  <span className={location ? "text-slate-200" : "text-slate-400"}>
                    Location shared
                    {location && (
                      <span className="font-mono text-slate-400 text-[11px] ml-1">
                        ({location.lat.toFixed(5)}, {location.lng.toFixed(5)} {location.accuracy ? `±${Math.round(location.accuracy)}m` : ""})
                      </span>
                    )}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${nearestStation ? "text-emerald-400" : "text-slate-500"}`} />
                  <span className={nearestStation ? "text-slate-200" : "text-slate-400"}>
                    Nearest station identified
                    {nearestStation && (
                      <span className="text-slate-300 font-medium text-[11px] ml-1">
                        ({nearestStation.station_name || nearestStation.name} [{nearestStation.station_code || nearestStation.code}])
                      </span>
                    )}
                  </span>
                </li>
              </ul>
            </div>
          )}

          {/* EMERGENCY CONTACT SMS (Section 5: Native Device SMS) */}
          {location && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div>
                  <h3 className="text-xs font-black tracking-wider text-slate-200 uppercase flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                    EMERGENCY CONTACT SMS
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Emergency contacts
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                  6 contacts configured
                </span>
              </div>

              {smsNotice && (
                <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-center">
                  <p className="text-[11px] text-blue-200 font-medium">
                    {smsNotice}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Messaging app opened — delivery not confirmed
                  </p>
                </div>
              )}

              {/* List of 6 configured contacts */}
              <div className="space-y-2">
                {AUTHORIZED_SOS_RECIPIENTS.map((phone, idx) => {
                  const hasOpened = Boolean(openedSmsContacts[phone]);
                  const contactSmsUri = buildNativeSmsUri(phone, nativeShareMsg);

                  return (
                    <div
                      key={phone}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 gap-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-[11px] font-mono font-bold text-slate-300">
                          {maskPhoneNumber(phone)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Contact {idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {hasOpened ? (
                          <div className="flex items-center gap-2 text-right">
                            <span className="text-[10px] text-emerald-400 font-semibold leading-tight">
                              SMS draft opened. Tap Send on your phone.
                            </span>
                            <a
                              href={contactSmsUri}
                              onClick={() => {
                                setOpenedSmsContacts((prev) => ({ ...prev, [phone]: true }));
                                setSmsNotice("SMS prepared — tap Send in your messaging app");
                              }}
                              className="text-[10px] text-slate-400 hover:text-white underline"
                              title="Re-open SMS"
                            >
                              Reopen
                            </a>
                          </div>
                        ) : (
                          <a
                            id={idx === 0 ? "sos-open-sms-button" : `sos-open-sms-button-${idx}`}
                            href={contactSmsUri}
                            onClick={() => {
                              setOpenedSmsContacts((prev) => ({ ...prev, [phone]: true }));
                              setSmsNotice("SMS prepared — tap Send in your messaging app");
                            }}
                            className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition-all no-underline shadow cursor-pointer"
                            title="Open SMS to SOS Contact"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>{"Open SMS"}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-[10px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">
                  Delivery Truthfulness Note:
                </p>
                <p>
                  Your phone's Messages app will open. Review and tap Send. We do not claim background or automatic SMS delivery.
                </p>
              </div>
            </div>
          )}

          {/* Retry Button for Failed States */}
          {[SOS_STATES.GPS_FAILURE, SOS_STATES.PERMISSION_DENIED, SOS_STATES.NETWORK_FAILURE].includes(sosState) && (
            <button
              type="button"
              id="sos-retry-button"
              onClick={acquireGPS}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Acquiring Location</span>
            </button>
          )}

          {/* Honest Footer Notice */}
          <div className="pt-2 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-500">
              Honest Emergency Notice: SMS is launched via your native device Messages app. We do not claim background or automatic SMS delivery.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}