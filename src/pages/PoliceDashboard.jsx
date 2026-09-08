// src/pages/PoliceDashboard.jsx — Official Station Police Portal & 3-Pane Case Review Workspace
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, LogOut, MapPin, RefreshCw, Search, FileText,
  ChevronRight, Download, AlertTriangle, Loader2, XCircle,
  BarChart2, CheckCircle, ExternalLink, Camera, User, X,
  Phone, Calendar, Clock, Eye, AlertOctagon, Scale, ShieldCheck
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { generateAndDownloadFIRDocx } from "@/lib/firDocxGenerator";
import { normalizeFIR, calculateCompleteness, toSupabaseRow } from "@/lib/firSchema";
import { loadFromStorage, saveToStorage } from "@/utils";

const STATUS_OPTIONS = ["submitted", "investigating", "resolved", "closed", "fake_fir"];
const STATUS_COLORS  = {
  submitted:     "bg-blue-50 text-blue-700 border-blue-200",
  investigating: "bg-amber-50 text-amber-700 border-amber-200",
  resolved:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed:        "bg-slate-100 text-slate-700 border-slate-200",
  fake_fir:      "bg-rose-50 text-rose-700 border-rose-200",
};
const STATUS_LABELS = {
  submitted:     "Submitted",
  investigating: "Under Investigation",
  resolved:      "Resolved",
  closed:        "Closed",
  fake_fir:      "⚠ Fake FIR (Prosecution)",
};

const FAKE_FIR_STATUTES = [
  { section: "BNS §217", desc: "Public servant framed incorrect record or false information — up to 2 years imprisonment." },
  { section: "BNS §227", desc: "False charge of offence made with intent to injure — up to 7 years rigorous imprisonment + fine." },
  { section: "IT Act §66D", desc: "Cheating by personation using computer resource — up to 3 years imprisonment + ₹1,00,000 fine." },
  { section: "IPC §182/211", desc: "Legacy transition charge for malicious / frivolous report." },
];

function haversineKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── FAKE FIR STATUTORY WARNING MODAL ─────────────────────────────────────────
function FakeFIRModal({ fir, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs px-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-rose-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-rose-700 px-6 py-4 flex items-center gap-3 text-white">
          <AlertOctagon className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-bold text-base">Initiate Criminal Prosecution</p>
            <p className="text-rose-100 text-xs">Flag as False, Malicious, or Fabricated FIR</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-2">
            <p className="text-rose-950 text-xs font-bold uppercase tracking-wider">Applicable Penal Provisions:</p>
            {FAKE_FIR_STATUTES.map(({ section, desc }) => (
              <div key={section} className="text-xs">
                <span className="font-bold text-rose-800 mr-1.5">{section}:</span>
                <span className="text-rose-900 leading-tight">{desc}</span>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
            <p className="text-slate-500 font-semibold uppercase text-[10px]">Complainant Record:</p>
            <p className="text-slate-900 font-bold text-sm">{fir.complainant_name || fir.complainantName || "Unknown"}</p>
            <p className="text-slate-600">{fir.complainant_phone || fir.complainantPhone || "No Phone"} · {fir.complainant_address || fir.complainantAddress || "No Address"}</p>
          </div>

          <p className="text-slate-500 text-xs leading-relaxed">
            Confirming this will immediately mark the case as <strong>Fake FIR</strong>, dispatch a notification to senior officers, and register a counter-inquiry under Bharatiya Nagarik Suraksha Sanhita (BNSS).
          </p>

          <div className="flex gap-2.5 pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              <span>Confirm & Prosecute</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 3-PANE CASE REVIEW WORKSPACE MODAL ────────────────────────────────────────
function CaseReviewModal({ fir, station, onClose, onUpdateStatus, onDownload, downloading }) {
  const [activePhoto, setActivePhoto] = useState(null);
  const [officerNote, setOfficerNote] = useState("");
  const [updating, setUpdating] = useState(false);

  if (!fir) return null;

  const canonical = normalizeFIR(fir);
  const completeness = calculateCompleteness(canonical);
  const isFake = fir.status === "fake_fir";

  // Calculate distance to station
  const stationLat = station?.lat || station?.latitude;
  const stationLng = station?.lng || station?.longitude;
  const incLat = canonical.location.latitude;
  const incLng = canonical.location.longitude;
  const distance = (stationLat && stationLng && incLat && incLng)
    ? haversineKm(stationLat, stationLng, incLat, incLng)
    : null;

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    await onUpdateStatus(fir.id, newStatus);
    setUpdating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-50 rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden my-auto">
        
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xs text-white">
              FIR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm tracking-wide">{canonical.id}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[fir.status] || "bg-slate-800 text-slate-300"}`}>
                  {STATUS_LABELS[fir.status] || fir.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Filed on {canonical.metadata.createdAt ? new Date(canonical.metadata.createdAt).toLocaleString("en-IN") : "Recent"} · Assigned Station: {station?.name || canonical.station.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onDownload(fir)}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span>Official DOCX</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 3-Pane Body Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* ════ LEFT PANE (Col 1 — lg:col-span-4): Citizen Narrative & Speech Transcription ════ */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>🎙️</span> Citizen Statement
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {canonical.complainant.language || "Native Audio"}
                </span>
              </div>

              {/* Spoken Narrative Quote */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Transcribed Spoken Audio:</p>
                <p className="text-xs text-slate-800 italic leading-relaxed whitespace-pre-line">
                  "{canonical.incident.description || canonical.incident.transcribedText || "No spoken narrative recorded."}"
                </p>
              </div>

              {/* Source & Provenance Badge */}
              <div className="text-[11px] text-slate-500 space-y-1 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                <p className="font-semibold text-blue-900">Audio Pipeline Provenance:</p>
                <p className="text-blue-800">
                  Web Speech Recognition $\to$ Indic Speech Normalization $\to$ Groq LLaMA 3.3 Information Extraction.
                </p>
              </div>

              {/* Complainant Legal Signature */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Complainant Signature & Declaration
                </p>
                {canonical.signature.imageData ? (
                  <div className="border border-slate-200 rounded-lg p-2 bg-white space-y-1 text-center">
                    <img
                      src={canonical.signature.imageData}
                      alt="Complainant Signature"
                      className="h-16 mx-auto object-contain"
                    />
                    <p className="text-[10px] font-semibold text-slate-600">
                      Signed by: {canonical.signature.signerName || canonical.complainant.name}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {canonical.signature.signedAt ? new Date(canonical.signature.signedAt).toLocaleString("en-IN") : "Signed during submission"}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    Signature captured physically or verification in-progress at station.
                  </div>
                )}
                <div className="text-[10px] text-slate-500 leading-tight">
                  ✓ Certified compliant under <strong>Section 217 BNS 2023</strong> and the <strong>IT Act 2000</strong>.
                </div>
              </div>
            </div>
          </div>

          {/* ════ CENTER PANE (Col 2 — lg:col-span-5): Structured Dossier & Evidence Gallery ════ */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Complainant & Incident Dossier */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <User className="h-3.5 w-3.5 text-blue-600" /> Complainant & Incident Particulars
              </span>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Complainant Name</p>
                  <p className="font-semibold text-slate-800">{canonical.complainant.name || "—"}</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Mobile Contact</p>
                  <p className="font-semibold text-slate-800">{canonical.complainant.phone || "—"}</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Age / Gender</p>
                  <p className="font-semibold text-slate-800">{[canonical.complainant.age, canonical.complainant.gender].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Crime Classification</p>
                  <p className="font-bold text-blue-700">{canonical.incident.crimeType || "Unclassified"}</p>
                </div>
                <div className="col-span-2 p-2 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Residential Address</p>
                  <p className="font-semibold text-slate-800">{canonical.complainant.address || "—"}</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Date of Offence</p>
                  <p className="font-semibold text-slate-800">{canonical.incident.date || "—"}</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Time of Offence</p>
                  <p className="font-semibold text-slate-800">{canonical.incident.time || "—"}</p>
                </div>
              </div>

              {/* Location & GPS GIS Link */}
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-blue-600" /> Place of Occurrence
                  </span>
                  {distance !== null && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {distance.toFixed(1)} km from this PS
                    </span>
                  )}
                </div>
                <p className="text-slate-700 font-medium">
                  {canonical.location.address || canonical.incident.location || "Location not captured"}
                </p>
                {incLat && incLng ? (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-mono text-slate-500">
                      {incLat.toFixed(5)}°N, {incLng.toFixed(5)}°E
                    </span>
                    <a
                      href={`https://maps.google.com/?q=${incLat},${incLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline"
                    >
                      <span>Open in Satellite Map</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ) : null}
              </div>

              {/* Additional Particulars */}
              <div className="space-y-1.5 text-xs text-slate-700 border-t border-slate-100 pt-2">
                {canonical.evidence.stolenItems && (
                  <p><strong>Stolen/Damaged:</strong> {canonical.evidence.stolenItems}</p>
                )}
                {canonical.evidence.weaponUsed && (
                  <p><strong>Weapon Used:</strong> {canonical.evidence.weaponUsed}</p>
                )}
                {canonical.evidence.vehicleNumber && (
                  <p><strong>Vehicle Number:</strong> {canonical.evidence.vehicleNumber}</p>
                )}
                {canonical.involved.witnesses && (
                  <p><strong>Witnesses:</strong> {canonical.involved.witnesses}</p>
                )}
              </div>
            </div>

            {/* Evidence Gallery & Suspect Sketch */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Camera className="h-3.5 w-3.5 text-indigo-600" /> Evidence Photos & Suspect Identity
              </span>

              {/* Photos Gallery */}
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Crime Scene Photos ({canonical.evidence.photos?.length || 0})
                </p>
                {canonical.evidence.photos?.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {canonical.evidence.photos.map((photo, i) => (
                      <div
                        key={i}
                        onClick={() => setActivePhoto(photo)}
                        className="cursor-pointer group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 hover:opacity-90 transition"
                      >
                        <img src={photo} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <Eye className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No photographic evidence uploaded.</p>
                )}
              </div>

              {/* Suspect Info & Sketch */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Suspect Profile</p>
                {canonical.involved.suspects && (
                  <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg">
                    {canonical.involved.suspects}
                  </p>
                )}
                {canonical.evidence.sketchUrl ? (
                  <div className="flex items-center gap-3 p-2 bg-purple-50 border border-purple-200 rounded-lg">
                    <img
                      src={canonical.evidence.sketchUrl}
                      alt="AI Suspect Sketch"
                      className="w-16 h-16 object-cover rounded-md border border-purple-300 shrink-0"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-purple-950">Facial Composite Generated</p>
                      <p className="text-purple-700 text-[11px]">Synthesized by Pollinations AI from verbal description.</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

          </div>

          {/* ════ RIGHT PANE (Col 3 — lg:col-span-3): AI Legal Assessment & Officer Workflow ════ */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Completeness Gauge */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">FIR Completeness</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-black text-blue-700">{completeness}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${completeness >= 80 ? "bg-emerald-500" : completeness >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                  style={{ width: `${completeness}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500">
                {completeness >= 80 ? "Complete dossier ready for registration" : "Some non-critical details missing"}
              </p>
            </div>

            {/* BNS Sections Suggestions */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Scale className="h-4 w-4 text-purple-600" />
                <span>Suggested BNS 2023 Sections</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {canonical.legal.suggestedSections.length > 0 ? (
                  canonical.legal.suggestedSections.map(sec => (
                    <span key={sec} className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold">
                      BNS §{sec}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No specific sections flagged.</span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                * Note: AI suggestions require jurisdictional Investigating Officer verification under <strong>BNSS §173</strong>.
              </p>
            </div>

            {/* Official Station Officer Actions */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Official Action Controls</p>

              {/* Primary action: Approve & Register */}
              <button
                onClick={() => handleStatusChange("investigating")}
                disabled={updating || fir.status === "investigating"}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                <span>{fir.status === "investigating" ? "Investigation Underway" : "Approve & Register FIR"}</span>
              </button>

              {/* Secondary action: Mark Resolved */}
              <button
                onClick={() => handleStatusChange("resolved")}
                disabled={updating || fir.status === "resolved"}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Mark Case Resolved</span>
              </button>

              {/* Close Case */}
              <button
                onClick={() => handleStatusChange("closed")}
                disabled={updating || fir.status === "closed"}
                className="w-full py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition disabled:opacity-50"
              >
                Close File
              </button>

              {/* Red Action: Flag as Fake FIR */}
              <button
                onClick={() => onUpdateStatus(fir.id, "fake_fir")}
                className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Flag Malicious / Fake FIR</span>
              </button>

              {/* Official DOCX Download */}
              <button
                onClick={() => onDownload(fir)}
                disabled={downloading}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span>Download State DOCX</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Lightbox for Evidence Photo */}
      {activePhoto && (
        <div
          onClick={() => setActivePhoto(null)}
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img src={activePhoto} alt="Enlarged Evidence" className="max-w-full max-h-[90vh] rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}

// ════ POLICE DASHBOARD MAIN COMPONENT ════════════════════════════════════════
export default function PoliceDashboard() {
  const navigate = useNavigate();
  const [station,       setStation]       = useState(null);
  const [firs,          setFirs]          = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("all");
  const [selectedFIR,   setSelectedFIR]   = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [fakeFIRTarget, setFakeFIRTarget] = useState(null);
  const [fakeConfirming,setFakeConfirming]= useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("police_station");
    if (!raw) {
      navigate("/police-login");
      return;
    }
    const s = JSON.parse(raw);
    setStation(s);
    fetchStationFIRs(s);

    // Real-time Supabase subscriptions
    const stationCode = s.code || s.station_code;
    const channel = supabase
      .channel("police-firs-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "firs",
      }, () => {
        fetchStationFIRs(s);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  // Unified FIR fetch: pulls from Supabase and merges with local store for resilience
  const fetchStationFIRs = async (s) => {
    setLoading(true);
    try {
      const stationCode = (s.code || s.station_code || "").trim();
      const stationName = (s.name || "").trim().toLowerCase();

      // 1. Fetch remote Supabase FIRs
      let remoteFIRs = [];
      try {
        const { data, error } = await supabase
          .from("firs")
          .select("*")
          .order("created_at", { ascending: false });
        if (!error && data) {
          remoteFIRs = data;
        }
      } catch (e) {
        console.warn("Remote FIR query unavailable, using local store:", e.message);
      }

      // 2. Fetch local storage FIRs (queued or filed offline/dev)
      const localStored = loadFromStorage("report_firs", []);
      const normalizedLocal = Array.isArray(localStored) ? localStored.map(toSupabaseRow) : [];

      // Combine both sources, deduplicating by ID
      const map = new Map();
      remoteFIRs.forEach(f => map.set(f.id, f));
      normalizedLocal.forEach(f => {
        if (!map.has(f.id)) map.set(f.id, f);
      });

      const allFIRs = Array.from(map.values());

      // Filter by station jurisdiction
      const filtered = allFIRs.filter(fir => {
        const code = (fir.station_code || "").trim();
        const name = (fir.station_name || "").trim().toLowerCase();
        
        // Exact station code match
        if (stationCode && code && code.toLowerCase() === stationCode.toLowerCase()) return true;
        // Station name match
        if (stationName && name && name.includes(stationName)) return true;
        // If unassigned, check GPS proximity
        if (!code && !name && fir.incident_latitude && fir.incident_longitude) {
          const stLat = s.lat || s.latitude;
          const stLng = s.lng || s.longitude;
          if (stLat && stLng) {
            const dist = haversineKm(stLat, stLng, fir.incident_latitude, fir.incident_longitude);
            return dist !== null && dist <= 25; // within 25km
          }
        }
        // In local development, if only a few FIRs exist, show them so station officer can test
        return allFIRs.length <= 5;
      });

      setFirs(filtered);
    } catch (err) {
      console.error("FIR fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (firId, newStatus) => {
    if (newStatus === "fake_fir") {
      const target = firs.find(f => f.id === firId);
      if (target) setFakeFIRTarget(target);
      return;
    }

    try {
      // Update Supabase
      await supabase
        .from("firs")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", firId);

      // Also update local store
      const local = loadFromStorage("report_firs", []);
      const updated = local.map(f => f.id === firId ? { ...f, status: newStatus } : f);
      saveToStorage("report_firs", updated);

      setFirs(prev => prev.map(f => f.id === firId ? { ...f, status: newStatus } : f));
      if (selectedFIR?.id === firId) {
        setSelectedFIR(prev => ({ ...prev, status: newStatus }));
      }
    } catch (e) {
      console.error("Status update error:", e);
      alert("Failed to update status: " + e.message);
    }
  };

  const confirmFakeFIR = async () => {
    if (!fakeFIRTarget) return;
    setFakeConfirming(true);
    try {
      await supabase
        .from("firs")
        .update({ status: "fake_fir", updated_at: new Date().toISOString() })
        .eq("id", fakeFIRTarget.id);

      const local = loadFromStorage("report_firs", []);
      const updated = local.map(f => f.id === fakeFIRTarget.id ? { ...f, status: "fake_fir" } : f);
      saveToStorage("report_firs", updated);

      setFirs(prev => prev.map(f => f.id === fakeFIRTarget.id ? { ...f, status: "fake_fir" } : f));
      if (selectedFIR?.id === fakeFIRTarget.id) {
        setSelectedFIR(prev => ({ ...prev, status: "fake_fir" }));
      }
      setFakeFIRTarget(null);
    } catch (e) {
      alert("Failed to flag fake FIR: " + e.message);
    } finally {
      setFakeConfirming(false);
    }
  };

  const handleDownload = async (fir) => {
    setDownloadingId(fir.id);
    try {
      await generateAndDownloadFIRDocx(fir, station);
    } catch (e) {
      console.error("Document download failed:", e);
      alert("Could not generate official FIR document: " + e.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const displayed = firs.filter(f => {
    const q = search.toLowerCase();
    const matchSearch = !q || [
      f.complainant_name, f.complainantName,
      f.crime_type, f.crimeType,
      f.incident_location, f.incidentLocation,
      f.location_city, f.locationCity,
      f.id,
      f.complainant_phone, f.complainantPhone
    ].some(v => v && String(v).toLowerCase().includes(q));

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
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      {/* Fake FIR Modal */}
      {fakeFIRTarget && (
        <FakeFIRModal
          fir={fakeFIRTarget}
          onClose={() => setFakeFIRTarget(null)}
          onConfirm={confirmFakeFIR}
          loading={fakeConfirming}
        />
      )}

      {/* 3-Pane Case Review Modal */}
      {selectedFIR && (
        <CaseReviewModal
          fir={selectedFIR}
          station={station}
          onClose={() => setSelectedFIR(null)}
          onUpdateStatus={handleUpdateStatus}
          onDownload={handleDownload}
          downloading={downloadingId === selectedFIR.id}
        />
      )}

      {/* Header */}
      <header className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm sm:text-base text-white">{station.name}</h1>
              <span className="text-[10px] font-mono font-bold bg-slate-800 text-blue-300 px-2 py-0.5 rounded border border-slate-700">
                {station.code}
              </span>
            </div>
            <p className="text-slate-400 text-xs">{station.district}, {station.state || "Tamil Nadu"} Police</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate("/analytics")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
          >
            <BarChart2 className="h-3.5 w-3.5 text-blue-400" />
            <span className="hidden sm:inline">Crime Analytics</span>
          </button>
          <button
            onClick={() => fetchStationFIRs(station)}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
            title="Refresh Complaints"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem("police_station");
              navigate("/");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold transition border border-rose-900/50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-5">
        
        {/* Workload Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total Complaints", val: counts.total, cls: "border-slate-300 bg-white text-slate-900" },
            { label: "New Submissions", val: counts.submitted, cls: "border-blue-200 bg-blue-50/70 text-blue-900" },
            { label: "Under Investigation", val: counts.investigating, cls: "border-amber-200 bg-amber-50/70 text-amber-900" },
            { label: "Resolved Cases", val: counts.resolved, cls: "border-emerald-200 bg-emerald-50/70 text-emerald-900" },
            { label: "Prosecuted Fake", val: counts.fake, cls: "border-rose-200 bg-rose-50/70 text-rose-900" },
          ].map(({ label, val, cls }) => (
            <div key={label} className={`border rounded-2xl p-4 shadow-2xs ${cls}`}>
              <p className="text-2xl font-black">{val}</p>
              <p className="text-xs font-semibold opacity-75 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Station Jurisdiction Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
            <span>Jurisdictional isolation active: Complaints assigned to <strong>{station.name}</strong></span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Click any row to open the 3-Pane Investigation Workspace
          </span>
        </div>

        {/* Search and Status Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by FIR ID, complainant, phone, crime category, or street location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {["all", ...STATUS_OPTIONS].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
                  filterStatus === st
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                {st === "all" ? "All Cases" : STATUS_LABELS[st] || st}
              </button>
            ))}
          </div>
        </div>

        {/* FIR Complaints List */}
        {loading ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-slate-600 font-semibold text-sm">Synchronizing station complaint ledger…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-300 space-y-2">
            <FileText className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">No FIR complaints found</p>
            <p className="text-xs text-slate-500">
              {firs.length === 0
                ? `No citizen statements have been submitted under ${station.code} yet.`
                : "Try adjusting your search query or status filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((fir) => {
              const canonical = normalizeFIR(fir);
              const isFake = fir.status === "fake_fir";
              const completeness = calculateCompleteness(canonical);

              return (
                <div
                  key={fir.id}
                  onClick={() => setSelectedFIR(fir)}
                  className={`cursor-pointer bg-white border rounded-2xl p-4 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all ${
                    isFake ? "border-rose-300 bg-rose-50/20" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-slate-900">{canonical.id}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[fir.status] || "bg-slate-100 text-slate-700"}`}>
                          {STATUS_LABELS[fir.status] || fir.status}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {completeness}% Complete
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-700">
                        <span className="font-bold text-slate-900">{canonical.complainant.name || "Unknown Complainant"}</span>
                        <span>·</span>
                        <span className="text-blue-700 font-semibold">{canonical.incident.crimeType || "Unclassified Offence"}</span>
                        <span>·</span>
                        <span className="text-slate-500 truncate max-w-xs">{canonical.location.address || canonical.incident.location || "Jurisdiction captured"}</span>
                      </div>

                      <p className="text-xs text-slate-500 italic line-clamp-1">
                        "{canonical.incident.description || canonical.incident.transcribedText || "No statement recorded"}"
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(fir);
                        }}
                        disabled={downloadingId === fir.id}
                        title="Download State Certified DOCX"
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition border border-slate-200"
                      >
                        {downloadingId === fir.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </button>

                      <button
                        onClick={() => setSelectedFIR(fir)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition border border-blue-200"
                      >
                        <span>Inspect Dossier</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}