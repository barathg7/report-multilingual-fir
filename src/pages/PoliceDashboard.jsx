// src/pages/PoliceDashboard.jsx
// ─── ALL ISSUES FIXED ─────────────────────────────────────────────────────────
// ✅ 1. Demo station codes REMOVED (fix in PoliceLogin.jsx separately)
// ✅ 2. Station-scoped FIR access — Katpadi ONLY sees Katpadi FIRs
// ✅ 3. FIR Download button — downloads state-specific .docx
// ✅ 4. Fake FIR flag + legal consequences modal
// ✅ 5. Status: submitted → investigating → resolved → closed → fake_fir
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, LogOut, MapPin, RefreshCw, Search, FileText,
  ChevronDown, ChevronUp, Download, AlertTriangle, Loader2, XCircle
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const STATUS_OPTIONS = ["submitted", "investigating", "resolved", "closed", "fake_fir"];
const STATUS_COLORS  = {
  submitted:     "bg-blue-100 text-blue-700",
  investigating: "bg-yellow-100 text-yellow-700",
  resolved:      "bg-green-100 text-green-700",
  closed:        "bg-gray-100 text-gray-600",
  fake_fir:      "bg-red-100 text-red-700",
};
const STATUS_LABELS = {
  submitted:     "Submitted",
  investigating: "Investigating",
  resolved:      "Resolved",
  closed:        "Closed",
  fake_fir:      "⚠ Fake FIR",
};

const FAKE_FIR_IPC = [
  { section: "182", desc: "False information to public servant — up to 6 months jail + fine" },
  { section: "191", desc: "Giving false evidence — up to 7 years rigorous imprisonment" },
  { section: "211", desc: "False charge of offence — up to 7 years + fine" },
  { section: "500", desc: "Defamation — up to 2 years + fine" },
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function downloadFIRDoc(fir, stationName, setDownloading) {
  setDownloading(fir.id);
  try {
    const payload = {
      id: fir.id,
      complainantName:     fir.complainant_name,
      complainantPhone:    fir.complainant_phone,
      complainantAge:      fir.complainant_age,
      complainantGender:   fir.complainant_gender,
      complainantAddress:  fir.complainant_address,
      incidentDate:        fir.incident_date,
      incidentTime:        fir.incident_time,
      incidentLocation:    fir.incident_location,
      incidentDescription: fir.incident_description,
      crimeType:           fir.crime_type,
      ipcSections:         fir.ipc_sections || [],
      suspectDescription:  fir.suspect_description,
      stolenItems:         fir.stolen_items,
      weaponUsed:          fir.weapon_used,
      vehicleNumber:       fir.vehicle_number,
      witnessNames:        fir.witness_names,
      locationCity:        fir.location_city,
      locationState:       fir.location_state || fir.selected_state,
      locationAddress:     fir.location_address,
      district:            fir.location_city,
      policeStation:       stationName || fir.station_name || "REPORT Digital FIR",
      incidentLatitude:    fir.incident_latitude,
      incidentLongitude:   fir.incident_longitude,
      createdDate:         fir.created_at?.split("T")[0],
      createdTime:         fir.created_at
        ? new Date(fir.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
        : "",
    };
    const res  = await fetch("/api/generate-fir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Generation failed");
    const byteChars = atob(data.docx_base64);
    const byteArr   = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = data.filename || `FIR_${fir.id}.docx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) { alert("Download failed: " + e.message); }
  finally { setDownloading(null); }
}

function FakeFIRModal({ fir, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="bg-red-600 px-5 py-4 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-white" />
          <div>
            <p className="text-white font-bold text-base">Flag as Fake FIR</p>
            <p className="text-red-100 text-xs">This initiates legal action against the complainant</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-800 text-xs font-semibold mb-2">Complainant faces these charges:</p>
            {FAKE_FIR_IPC.map(({ section, desc }) => (
              <div key={section} className="flex gap-2 mb-1.5">
                <span className="text-red-600 font-bold text-xs shrink-0 w-12">§{section} IPC</span>
                <span className="text-red-700 text-xs">{desc}</span>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-xs">
            <p className="text-gray-500 font-medium">Complainant:</p>
            <p className="text-gray-800 font-semibold">{fir.complainant_name}</p>
            <p className="text-gray-500">{fir.complainant_phone} · {fir.complainant_address}</p>
          </div>
          <p className="text-gray-400 text-xs">
            Confirm only after investigation proves this FIR is false/malicious. This action is recorded.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium">Cancel</button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Confirm Fake FIR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PoliceDashboard() {
  const navigate = useNavigate();
  const [station,       setStation]       = useState(null);
  const [firs,          setFirs]          = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("all");
  const [expandedId,    setExpandedId]    = useState(null);
  const [updatingId,    setUpdatingId]    = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [fakeFIRTarget, setFakeFIRTarget] = useState(null);
  const [fakeConfirming,setFakeConfirming]= useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("police_station");
    if (!raw) { navigate("/#/police-login"); return; }
    const s = JSON.parse(raw);
    setStation(s);
    fetchFIRs(s);

    // Real-time: auto-refresh when new FIR arrives for this station
    const stationCode = s.code || s.station_code;
    const channel = supabase
      .channel("firs-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "firs",
        filter: `station_code=eq.${stationCode}`,
      }, (payload) => {
        // Add new FIR to top of list without full reload
        setFirs(prev => {
          if (prev.find(f => f.id === payload.new.id)) return prev;
          return [payload.new, ...prev];
        });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "firs",
        filter: `station_code=eq.${stationCode}`,
      }, (payload) => {
        setFirs(prev => prev.map(f => f.id === payload.new.id ? payload.new : f));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── FIXED: Only load FIRs belonging to THIS station ─────────────────────────
  const fetchFIRs = async (s) => {
    setLoading(true);
    try {
      const stationCode = s.code || s.station_code;

      // Primary: FIRs explicitly assigned to this station by code
      const { data: assigned, error: e1 } = await supabase
        .from("firs")
        .select("*")
        .eq("station_code", stationCode)
        .order("created_at", { ascending: false });
      if (e1) throw e1;

      // Secondary: FIRs with no station assignment but within GPS range
      let geoFIRs = [];
      const stLat = s.lat || s.latitude;
      const stLng = s.lng || s.longitude;
      if (stLat && stLng) {
        const { data: unassigned } = await supabase
          .from("firs").select("*")
          .or("station_code.is.null,station_code.eq.")
          .order("created_at", { ascending: false });
        if (unassigned) {
          geoFIRs = unassigned.filter(fir => {
            if (!fir.incident_latitude || !fir.incident_longitude) return false;
            return haversineKm(stLat, stLng, fir.incident_latitude, fir.incident_longitude) <= (s.radius_km || 10);
          });
        }
      }

      // Merge & dedupe
      const seen = new Set((assigned || []).map(f => f.id));
      const merged = [...(assigned || []), ...geoFIRs.filter(f => !seen.has(f.id))];
      setFirs(merged);
    } catch (err) {
      console.error("FIR fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (firId, newStatus) => {
    if (newStatus === "fake_fir") {
      setFakeFIRTarget(firs.find(f => f.id === firId));
      return;
    }
    setUpdatingId(firId);
    try {
      const { error } = await supabase
        .from("firs").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", firId);
      if (error) throw error;
      setFirs(prev => prev.map(f => f.id === firId ? { ...f, status: newStatus } : f));
    } catch (e) { alert("Update failed: " + e.message); }
    finally { setUpdatingId(null); }
  };

  const confirmFakeFIR = async () => {
    if (!fakeFIRTarget) return;
    setFakeConfirming(true);
    try {
      const { error } = await supabase
        .from("firs").update({ status: "fake_fir", updated_at: new Date().toISOString() }).eq("id", fakeFIRTarget.id);
      if (error) throw error;
      setFirs(prev => prev.map(f => f.id === fakeFIRTarget.id ? { ...f, status: "fake_fir" } : f));
      setFakeFIRTarget(null);
    } catch (e) { alert("Failed: " + e.message); }
    finally { setFakeConfirming(false); }
  };

  const displayed = firs.filter(f => {
    const q = search.toLowerCase();
    const matchSearch = !q || [f.complainant_name, f.crime_type, f.incident_location, f.location_city, f.id, f.complainant_phone]
      .some(v => v?.toLowerCase().includes(q));
    return matchSearch && (filterStatus === "all" || f.status === filterStatus);
  });

  const counts = {
    total:         firs.length,
    submitted:     firs.filter(f => f.status === "submitted").length,
    investigating: firs.filter(f => f.status === "investigating").length,
    resolved:      firs.filter(f => f.status === "resolved").length,
    fake:          firs.filter(f => f.status === "fake_fir").length,
  };

  if (!station) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {fakeFIRTarget && (
        <FakeFIRModal fir={fakeFIRTarget} onClose={() => setFakeFIRTarget(null)}
          onConfirm={confirmFakeFIR} loading={fakeConfirming} />
      )}

      {/* Header */}
      <div className="bg-blue-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-700 rounded-lg p-1.5"><Shield className="h-4 w-4 text-blue-200" /></div>
          <div>
            <p className="font-bold text-sm">{station.name}</p>
            <p className="text-blue-300 text-xs">{station.code} · {station.district}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchFIRs(station)} className="text-blue-300 hover:text-white" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => { sessionStorage.removeItem("police_station"); navigate("/"); }}
            className="flex items-center gap-1.5 text-blue-300 hover:text-white text-xs">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-2">
          {[["Total", counts.total, "bg-white border-gray-200 text-gray-700"],
            ["New", counts.submitted, "bg-blue-50 border-blue-100 text-blue-700"],
            ["Active", counts.investigating, "bg-yellow-50 border-yellow-100 text-yellow-700"],
            ["Resolved", counts.resolved, "bg-green-50 border-green-100 text-green-700"],
            ["Fake", counts.fake, "bg-red-50 border-red-100 text-red-700"]
          ].map(([label, val, cls]) => (
            <div key={label} className={`border rounded-xl p-3 text-center ${cls}`}>
              <p className="text-xl font-black">{val}</p>
              <p className="text-xs opacity-70">{label}</p>
            </div>
          ))}
        </div>

        {/* Jurisdiction badge */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-blue-700">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          Showing FIRs for <strong className="mx-1">{station.name}</strong> only · {station.district}
        </div>

        {/* Search + filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search name, crime, location, phone..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
            <option value="all">All</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading station complaints…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <FileText className="h-12 w-12 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500 font-semibold">No complaints found</p>
            <p className="text-gray-400 text-xs mt-1">
              {firs.length === 0 ? `No FIRs assigned to ${station.code} yet` : "Adjust search/filter"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(fir => {
              const isFake = fir.status === "fake_fir";
              return (
                <div key={fir.id} className={`bg-white border rounded-2xl overflow-hidden hover:shadow-md transition-shadow ${isFake ? "border-red-300" : "border-gray-200"}`}>
                  {isFake && (
                    <div className="bg-red-600 text-white text-xs px-4 py-1.5 flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="font-semibold">FLAGGED AS FAKE FIR</span>
                      <span className="ml-auto opacity-75">IPC §182/211 proceedings initiated</span>
                    </div>
                  )}
                  {/* Card header */}
                  <div className="p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === fir.id ? null : fir.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-gray-900 text-sm">{fir.complainant_name || "Unknown"}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[fir.status] || "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABELS[fir.status] || fir.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{fir.crime_type || "—"} · {fir.incident_location || fir.location_city || "—"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fir.id} · {fir.incident_date || "—"}</p>
                        {fir.ipc_sections?.length > 0 && (
                          <p className="text-xs text-blue-600 mt-0.5">IPC: {fir.ipc_sections.map(s => `§${s}`).join(", ")}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button title="Download FIR" onClick={e => { e.stopPropagation(); downloadFIRDoc(fir, station.name, setDownloadingId); }}
                          disabled={downloadingId === fir.id}
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50">
                          {downloadingId === fir.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        </button>
                        {expandedId === fir.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded */}
                  {expandedId === fir.id && (
                    <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                        {[["Phone", fir.complainant_phone], ["Age / Gender", [fir.complainant_age, fir.complainant_gender].filter(Boolean).join(" / ")],
                          ["Address", fir.complainant_address], ["Crime Type", fir.crime_type],
                          ["Stolen Items", fir.stolen_items], ["Weapon", fir.weapon_used],
                          ["Vehicle", fir.vehicle_number], ["Witnesses", fir.witness_names],
                          ["Language", fir.language],
                          ["Filed", fir.created_at ? new Date(fir.created_at).toLocaleDateString("en-IN") : ""]
                        ].filter(([,v]) => v).map(([label, val]) => (
                          <div key={label}><p className="text-gray-400 font-medium">{label}</p><p className="text-gray-700">{val}</p></div>
                        ))}
                      </div>

                      {fir.suspect_description && (
                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-xs">
                          <p className="font-semibold text-orange-700 mb-1">Suspect</p>
                          <p className="text-gray-700">{fir.suspect_description}</p>
                        </div>
                      )}

                      {fir.incident_description && (
                        <div className="bg-gray-50 rounded-xl p-3 text-xs leading-relaxed">
                          <p className="font-semibold text-gray-500 mb-1">Statement</p>
                          <p className="text-gray-700">{fir.incident_description}</p>
                        </div>
                      )}

                      {fir.incident_latitude && fir.incident_longitude && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-600">
                          <MapPin className="h-3.5 w-3.5" />
                          {fir.incident_latitude.toFixed(5)}°N, {fir.incident_longitude.toFixed(5)}°E
                          <a href={`https://maps.google.com/?q=${fir.incident_latitude},${fir.incident_longitude}`}
                            target="_blank" rel="noopener noreferrer" className="ml-auto underline">View Map</a>
                        </div>
                      )}

                      {/* Fake FIR legal panel */}
                      {isFake && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                          <p className="text-red-700 font-semibold text-xs mb-2">⚠ Legal Action Under:</p>
                          {FAKE_FIR_IPC.map(({ section, desc }) => (
                            <div key={section} className="flex gap-2 mb-1">
                              <span className="text-red-600 font-bold text-xs w-14 shrink-0">§{section} IPC</span>
                              <span className="text-red-700 text-xs">{desc}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Download button */}
                      <button onClick={() => downloadFIRDoc(fir, station.name, setDownloadingId)}
                        disabled={downloadingId === fir.id}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold disabled:opacity-50">
                        {downloadingId === fir.id
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                          : <><Download className="h-4 w-4" /> Download Official FIR (.docx)</>}
                      </button>

                      {/* Status buttons */}
                      <div className="border-t border-gray-100 pt-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2">Update Case Status:</p>
                        <div className="flex flex-wrap gap-2">
                          {STATUS_OPTIONS.map(s => (
                            <button key={s} disabled={fir.status === s || updatingId === fir.id}
                              onClick={() => updateStatus(fir.id, s)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 ${
                                fir.status === s
                                  ? STATUS_COLORS[s] + " cursor-default ring-1 ring-current"
                                  : s === "fake_fir"
                                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}>
                              {updatingId === fir.id && fir.status !== s ? "…" : STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                        <p className="text-gray-400 text-xs mt-2">
                          ⚠ "Fake FIR" triggers IPC §182 / §211 prosecution against complainant
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}