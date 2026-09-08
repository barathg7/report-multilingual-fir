/**
 * FIRDownload.jsx
 * FIXED: Uses static imports for docx + file-saver (Vite bundles them correctly).
 * Dynamic import("docx") fails in browser — must be static top-level import.
 */

import { useState, useEffect, useCallback } from "react";
import {
  MapPin, Download, Shield, CheckCircle, Navigation,
  Search, ChevronRight, Loader2, AlertTriangle, Building2,
} from "lucide-react";
import Button from "@/components/ui/Button";
import {
  ALL_STATES, STATE_TEMPLATES,
  getNearbyStations, getStationsByState,
  detectStateFromGPS,
} from "@/utils/policeStations";

import { generateAndDownloadFIRDocx } from "@/lib/firDocxGenerator";

// ═════════════════════════════════════════════════════════════════════════════
// FIRDownload Component
// ═════════════════════════════════════════════════════════════════════════════

export default function FIRDownload({ fir, location }) {
  const [step,           setStep]           = useState(1); // 1=state, 2=station, 3=download
  const [selectedState,  setSelectedState]  = useState("");
  const [stateSearch,    setStateSearch]    = useState("");
  const [selectedStation,setSelectedStation]= useState(null);
  const [nearbyStations, setNearbyStations] = useState([]);
  const [allStateStations,setAllStateStations]=useState([]);
  const [stationSearch,  setStationSearch]  = useState("");
  const [gpsDetecting,   setGpsDetecting]   = useState(false);
  const [generating,     setGenerating]     = useState(false);
  const [downloaded,     setDownloaded]     = useState(false);
  const [error,          setError]          = useState("");

  // Auto-detect state from FIR location
  useEffect(() => {
    const state = fir?.locationState || location?.state;
    if (state && ALL_STATES.includes(state)) {
      setSelectedState(state);
      setStep(2);
    }
  }, [fir, location]);

  // Load stations when state selected
  useEffect(() => {
    if (!selectedState) return;
    const stations = getStationsByState(selectedState);
    setAllStateStations(stations);

    // If we have GPS, load nearby too
    const lat = fir?.incidentLatitude || location?.latitude;
    const lng = fir?.incidentLongitude || location?.longitude;
    if (lat && lng) {
      const nearby = getNearbyStations(lat, lng, 100, 5).filter(
        (s) => s.state === selectedState
      );
      setNearbyStations(nearby);
    }
  }, [selectedState, fir, location]);

  // GPS detect state
  const detectFromGPS = () => {
    setGpsDetecting(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const nearby = getNearbyStations(latitude, longitude, 200, 5);
        setNearbyStations(nearby);
        if (nearby[0]) {
          setSelectedState(nearby[0].state);
          setStep(2);
        }
        setGpsDetecting(false);
      },
      () => setGpsDetecting(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handle download
  const handleDownload = async () => {
    setGenerating(true);
    setError("");
    try {
      const filename = await generateAndDownloadFIRDocx(fir, selectedStation, selectedState);
      setDownloaded(true);
      setStep(3);
    } catch (e) {
      console.error(e);
      setError(`Download failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const filteredStates = ALL_STATES.filter((s) =>
    s.toLowerCase().includes(stateSearch.toLowerCase())
  );

  const filteredStations = (stationSearch
    ? allStateStations.filter((s) =>
        s.name.toLowerCase().includes(stationSearch.toLowerCase()) ||
        s.district.toLowerCase().includes(stationSearch.toLowerCase())
      )
    : allStateStations
  ).slice(0, 20);

  return (
    <div className="space-y-4">

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {["Select State", "Choose Station", "Download FIR"].map((label, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              step > i + 1 ? "bg-green-500 text-white" :
              step === i + 1 ? "bg-blue-600 text-white" :
              "bg-gray-200 text-gray-500"
            }`}>
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span className={`text-xs font-medium truncate ${step === i + 1 ? "text-blue-700" : "text-gray-400"}`}>
              {label}
            </span>
            {i < 2 && <div className="flex-1 h-0.5 bg-gray-200 rounded-full ml-1" />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: State Selection ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              Select Your State
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              FIR will be generated in your state's official bilingual format
            </p>
          </div>

          {/* GPS detect */}
          <button
            onClick={detectFromGPS}
            disabled={gpsDetecting}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium hover:bg-green-100 transition"
          >
            <Navigation className="h-4 w-4 shrink-0" />
            {gpsDetecting ? "Detecting your state…" : "📍 Auto-detect state from GPS"}
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={stateSearch}
              onChange={(e) => setStateSearch(e.target.value)}
              placeholder="Search state…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* State grid */}
          <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {filteredStates.map((state) => (
              <button
                key={state}
                onClick={() => { setSelectedState(state); setStep(2); }}
                className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all ${
                  selectedState === state
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-blue-300"
                }`}
              >
                <span className="text-lg shrink-0">{STATE_EMOJI[state] || "🏛️"}</span>
                <span className="text-xs font-semibold text-gray-800 leading-tight">{state}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2: Police Station Selection ───────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                Choose Police Station
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {STATE_EMOJI[selectedState]} {selectedState} — select your preferred PS
              </p>
            </div>
            <button onClick={() => setStep(1)} className="text-xs text-blue-600 underline">
              Change State
            </button>
          </div>

          {/* Nearby stations (GPS-based) */}
          {nearbyStations.length > 0 && (
            <div>
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1.5">
                📍 Nearest to you
              </p>
              <div className="space-y-1.5">
                {nearbyStations.map((ps) => (
                  <button
                    key={ps.id}
                    onClick={() => setSelectedStation(ps)}
                    className={`w-full text-left p-2.5 rounded-xl border-2 transition-all ${
                      selectedStation?.id === ps.id
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{ps.name}</p>
                        <p className="text-xs text-gray-500">{ps.district} · {ps.phone}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                          {ps.distanceKm?.toFixed(1)} km
                        </span>
                        {selectedStation?.id === ps.id && (
                          <CheckCircle className="h-4 w-4 text-blue-600 mt-1 ml-auto" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All stations in state (searchable) */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              All stations in {selectedState}
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={stationSearch}
                onChange={(e) => setStationSearch(e.target.value)}
                placeholder="Search by name or district…"
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {filteredStations.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  No stations found. Try a different search.
                </p>
              )}
              {filteredStations.map((ps) => (
                <button
                  key={ps.id}
                  onClick={() => setSelectedStation(ps)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                    selectedStation?.id === ps.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-100 bg-gray-50 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{ps.name}</p>
                      <p className="text-[10px] text-gray-500">{ps.district}</p>
                    </div>
                    {selectedStation?.id === ps.id && (
                      <CheckCircle className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Proceed button */}
          <Button
            full
            onClick={() => setStep(3)}
            disabled={!selectedStation}
          >
            <ChevronRight className="h-4 w-4" />
            Proceed to Download
          </Button>

          {!selectedStation && (
            <p className="text-xs text-center text-gray-400">
              Select a police station to continue
            </p>
          )}
        </div>
      )}

      {/* ── STEP 3: Download ────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Download className="h-4 w-4 text-blue-600" />
            Download Official FIR
          </h3>

          {/* Summary card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">FIR Summary</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-blue-800">
              <p>🆔 <strong>FIR ID:</strong> {fir?.id || "Auto"}</p>
              <p>🗺️ <strong>State:</strong> {selectedState}</p>
              <p>🏛️ <strong>Station:</strong> {selectedStation?.name}</p>
              <p>📍 <strong>District:</strong> {selectedStation?.district}</p>
              <p>⚖️ <strong>BNS:</strong> {fir?.ipcSections?.map(s => `§${s}`).join(", ") || "N/A"}</p>
              <p>🚨 <strong>Crime:</strong> {fir?.crimeType || "N/A"}</p>
            </div>
          </div>

          {/* Template info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-600 flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-500 shrink-0" />
            <span>
              Template: <strong>{STATE_TEMPLATES[selectedState]}</strong> ·
              NCRB I.I.F.-I Format · Bilingual
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Download button */}
          {!downloaded ? (
            <Button full onClick={handleDownload} disabled={generating} variant="success">
              {generating
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating DOCX…</>
                : <><Download className="h-4 w-4" /> Download {selectedState} FIR (.docx)</>}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 font-medium text-sm">
                <CheckCircle className="h-5 w-5" />
                ✅ FIR downloaded successfully!
              </div>
              <Button variant="outline" full onClick={handleDownload} disabled={generating}>
                <Download className="h-4 w-4" /> Download Again
              </Button>
            </div>
          )}

          <button
            onClick={() => { setStep(2); setDownloaded(false); }}
            className="text-xs text-gray-400 underline w-full text-center"
          >
            ← Change station
          </button>
        </div>
      )}
    </div>
  );
}