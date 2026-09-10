// src/components/police/CaseReviewModal.jsx — 3-Pane Police Investigation Workspace Modal
import { useState } from "react";
import {
  X, Download, Loader2, User, MapPin, ExternalLink, Camera,
  Eye, Scale, ShieldCheck, CheckCircle, AlertTriangle, Clock,
  Mic, FileText, ChevronRight, CheckCircle2, ShieldAlert, Sparkles,
  AlertOctagon, Check
} from "lucide-react";
import { normalizeFIR, calculateCompleteness } from "@/lib/firSchema";

function haversineKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STATUS_PILLS = {
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  investigating: "bg-amber-50 text-amber-700 border-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-700 border-slate-200",
  fake_fir: "bg-rose-50 text-rose-700 border-rose-200",
};

const STATUS_LABELS = {
  submitted: "New Submission",
  investigating: "Under Investigation",
  resolved: "Case Resolved",
  closed: "Closed File",
  fake_fir: "⚠ Prosecuted Fake",
};

export default function CaseReviewModal({
  fir,
  station,
  onClose,
  onUpdateStatus,
  onVerifySection,
  onDownload,
  downloading,
}) {
  const [activePhoto, setActivePhoto] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [verifyingSec, setVerifyingSec] = useState(false);
  const [customSec, setCustomSec] = useState("");
  const [verifyMsg, setVerifyMsg] = useState(null);

  // Responsive mobile/tablet tab: "narrative" | "dossier" | "actions"
  const [mobileTab, setMobileTab] = useState("narrative");

  if (!fir) return null;

  const canonical = normalizeFIR(fir);
  const completeness = calculateCompleteness(canonical);
  const isFake = fir.status === "fake_fir";

  // Station Distance
  const stationLat = station?.lat || station?.latitude;
  const stationLng = station?.lng || station?.longitude;
  const incLat = canonical.location.latitude;
  const incLng = canonical.location.longitude;
  const distance = (stationLat && stationLng && incLat && incLng)
    ? haversineKm(stationLat, stationLng, incLat, incLng)
    : null;

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await onUpdateStatus(fir.id, newStatus);
    } finally {
      setUpdating(false);
    }
  };

  const handleVerifyLegalSection = async (secToVerify) => {
    if (!secToVerify || !fir?.id || !onVerifySection) return;
    const clean = String(secToVerify).replace(/^§/, "").trim();
    setVerifyingSec(true);
    setVerifyMsg(null);
    try {
      await onVerifySection(fir.id, clean);
      setVerifyMsg({ type: "success", text: `BNS §${clean} officially verified under BNSS §173.` });
      setCustomSec("");
    } catch (err) {
      setVerifyMsg({ type: "error", text: err.message || "Verification failed." });
    } finally {
      setVerifyingSec(false);
    }
  };

  // Verified list
  const verifiedList = Array.isArray(fir.verified_sections) && fir.verified_sections.length > 0
    ? fir.verified_sections
    : (Array.isArray(canonical.legal.verifiedSections) ? canonical.legal.verifiedSections : []);
  const verifiedSecCodes = new Set(verifiedList.map(v => typeof v === "object" ? v.section : String(v)));

  // Date format
  const dateFormatted = canonical.metadata.createdAt
    ? new Date(canonical.metadata.createdAt).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recent Entry";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-100 rounded-2xl max-w-7xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden my-auto">

        {/* ── TOP WORKSPACE BAR ────────────────────────────────────── */}
        <div className="bg-slate-950 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-mono font-black text-xs text-white shadow-xs shrink-0">
              FIR
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-extrabold text-sm sm:text-base tracking-wide text-white break-all">
                  {canonical.officialFIRNo
                    ? `FIR #${canonical.officialFIRNo}`
                    : canonical.submissionId
                    ? `ACK: ${canonical.submissionId}`
                    : canonical.id}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    STATUS_PILLS[fir.status] || "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  {STATUS_LABELS[fir.status] || fir.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                Filed on {dateFormatted} · Station: {station?.name || canonical.station.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onDownload(fir)}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50 min-h-[38px]"
              title="Download State Certified DOCX"
              aria-label="Download State Certified DOCX"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Official DOCX</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer min-w-[40px] min-h-[40px]"
              title="Close Workspace"
              aria-label="Close investigation workspace"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── MOBILE / TABLET SEGMENTED TAB SELECTOR (< lg) ──────── */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-2 sm:px-3 py-2 flex items-center gap-1.5 shrink-0">
          {[
            { id: "narrative", label: "1. Statement", icon: Mic },
            { id: "dossier", label: "2. Dossier", icon: User },
            { id: "actions", label: "3. Legal & Actions", icon: Scale },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobileTab(tab.id)}
                aria-pressed={active}
                className={`flex-1 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer min-h-[44px] ${
                  active
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── 3-PANE WORKSPACE BODY ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ════ LEFT PANE (Col 1 — lg:col-span-4): Citizen Narrative & Speech Transcription ════ */}
          <div className={`lg:col-span-4 space-y-4 ${mobileTab !== "narrative" ? "hidden lg:block" : ""}`}>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <span className="p-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                    <Mic className="h-3.5 w-3.5" />
                  </span>
                  <span>Citizen Verbal Statement</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {canonical.complainant.language || "Native Audio"}
                </span>
              </div>

              {/* Spoken Narrative Quote */}
              <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Transcribed Audio Record:</span>
                  <span className="text-emerald-700 font-mono">100% Verbatim</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-900 italic leading-relaxed whitespace-pre-line font-serif">
                  "{canonical.incident.description || canonical.incident.transcribedText || "No citizen verbal narrative recorded."}"
                </p>
              </div>

              {/* Speech & AI Pipeline Provenance */}
              <div className="text-xs text-slate-600 space-y-1.5 bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
                <p className="font-bold text-blue-950 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  <span>Audio Pipeline Provenance & Verification</span>
                </p>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  Captured via Web Speech API $\to$ Phonetic Normalization $\to$ Groq LLaMA 3.3 Semantic Extraction. All AI recommendations are advisory and legally partitioned from the certified record.
                </p>
              </div>

              {/* Complainant Legal Signature & Declaration */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Complainant Digital Signature & Affidavit</span>
                </p>

                {canonical.signature?.imageData ? (
                  <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2 text-center shadow-2xs">
                    <img
                      src={canonical.signature.imageData}
                      alt="Complainant Signature"
                      className="h-16 sm:h-20 mx-auto object-contain"
                    />
                    <div className="border-t border-slate-100 pt-1.5">
                      <p className="text-xs font-bold text-slate-800">
                        Signed by: {canonical.signature.signerName || canonical.complainant.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {canonical.signature.signedAt
                          ? new Date(canonical.signature.signedAt).toLocaleString("en-IN")
                          : "Captured during citizen submission"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                    <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Physical signature verification in-progress or complainant to verify in person at station.</span>
                  </div>
                )}

                <div className="text-[10px] text-slate-500 leading-tight bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  Digitally recorded citizen declaration — verification and legal processing remain subject to applicable law and police procedures.
                </div>
              </div>

            </div>

          </div>

          {/* ════ CENTER PANE (Col 2 — lg:col-span-5): Structured Dossier & Evidence Gallery ════ */}
          <div className={`lg:col-span-5 space-y-4 ${mobileTab !== "dossier" ? "hidden lg:block" : ""}`}>

            {/* Complainant & Incident Dossier */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="p-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                  <User className="h-3.5 w-3.5" />
                </span>
                <span>Complainant Intel & Incident Particulars</span>
              </span>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Complainant Name</p>
                  <p className="font-extrabold text-slate-900 text-sm">{canonical.complainant.name || "—"}</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Mobile Contact</p>
                  <p className="font-mono font-bold text-slate-900">{canonical.complainant.phone || "—"}</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Age / Gender</p>
                  <p className="font-semibold text-slate-800">
                    {[canonical.complainant.age, canonical.complainant.gender].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-100">
                  <p className="text-[10px] text-blue-600 font-bold uppercase">Crime Classification</p>
                  <p className="font-extrabold text-blue-900">{canonical.incident.crimeType || "Unclassified"}</p>
                </div>
                <div className="col-span-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Residential Address</p>
                  <p className="font-medium text-slate-800">{canonical.complainant.address || "—"}</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Date of Incident</p>
                  <p className="font-bold text-slate-900">{canonical.incident.date || "—"}</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Time of Incident</p>
                  <p className="font-bold text-slate-900">{canonical.incident.time || "—"}</p>
                </div>
              </div>

              {/* GIS & Location Mapping Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-blue-600" />
                    <span>Place of Occurrence</span>
                  </span>
                  {distance !== null && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 font-mono">
                      {distance.toFixed(1)} km from this PS
                    </span>
                  )}
                </div>
                <p className="text-slate-800 font-medium">
                  {canonical.location.address || canonical.incident.location || "Jurisdiction captured"}
                </p>
                {incLat && incLng && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                    <span className="text-[11px] font-mono text-slate-500">
                      {incLat.toFixed(5)}°N, {incLng.toFixed(5)}°E
                    </span>
                    <a
                      href={`https://maps.google.com/?q=${incLat},${incLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-800 hover:underline"
                    >
                      <span>Satellite View</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Additional Particulars */}
              {(canonical.evidence.stolenItems ||
                canonical.evidence.weaponUsed ||
                canonical.evidence.vehicleNumber ||
                canonical.involved.witnesses) && (
                <div className="space-y-1.5 text-xs text-slate-700 border-t border-slate-100 pt-3">
                  {canonical.evidence.stolenItems && (
                    <p><strong>Stolen / Damaged:</strong> {canonical.evidence.stolenItems}</p>
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
              )}
            </div>

            {/* Evidence Photos & Suspect Profile */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="p-1 rounded-md bg-purple-50 text-purple-700 border border-purple-100">
                  <Camera className="h-3.5 w-3.5" />
                </span>
                <span>Evidence Photos & Suspect Profile</span>
              </span>

              {/* Photo Gallery */}
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Crime Scene Photos ({canonical.evidence.photos?.length || 0})
                </p>
                {canonical.evidence.photos?.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {canonical.evidence.photos.map((photo, i) => (
                      <div
                        key={i}
                        onClick={() => setActivePhoto(photo)}
                        className="cursor-pointer group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:opacity-95 transition shadow-2xs"
                      >
                        <img src={photo} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <Eye className="h-5 w-5 text-white drop-shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                    No photographic evidence uploaded by complainant.
                  </p>
                )}
              </div>

              {/* Suspect Composite & Profile */}
              {(canonical.involved.suspects || canonical.evidence.sketchUrl) && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Suspect Intel & Facial Composite
                  </p>
                  {canonical.involved.suspects && (
                    <p className="text-xs text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      {canonical.involved.suspects}
                    </p>
                  )}
                  {canonical.evidence.sketchUrl && (
                    <div className="flex items-center gap-3 p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                      <img
                        src={canonical.evidence.sketchUrl}
                        alt="AI Suspect Sketch"
                        className="w-16 h-16 object-cover rounded-lg border border-purple-300 shadow-2xs shrink-0"
                      />
                      <div className="text-xs">
                        <p className="font-extrabold text-purple-950">Facial Composite Generated</p>
                        <p className="text-purple-800 text-[11px] mt-0.5">
                          Synthesized by Pollinations AI from verbal description.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* ════ RIGHT PANE (Col 3 — lg:col-span-3): Legal Assessment & Officer Workflow ════ */}
          <div className={`lg:col-span-3 space-y-4 ${mobileTab !== "actions" ? "hidden lg:block" : ""}`}>

            {/* Completeness Gauge */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                FIR Dossier Completeness
              </p>
              <p className="text-3xl font-black font-mono text-slate-900 leading-none">
                {completeness}%
              </p>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    completeness >= 80
                      ? "bg-emerald-500"
                      : completeness >= 50
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${completeness}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                {completeness >= 80 ? "Dossier ready for legal registration" : "Incomplete particulars"}
              </p>
            </div>

            {/* Case Audit Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                <span>Case Audit Timeline</span>
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">Complaint Intake Filed</p>
                    <p className="text-[10px] text-slate-400">{dateFormatted}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5 ${
                    fir.status !== "submitted" ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"
                  }`}>
                    {fir.status !== "submitted" ? <Check className="h-2.5 w-2.5" /> : "2"}
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">Station Intake & Assignment</p>
                    <p className="text-[10px] text-slate-500">Jurisdiction: {station?.name || canonical.station.name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5 ${
                    verifiedList.length > 0 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
                  }`}>
                    {verifiedList.length > 0 ? <Check className="h-2.5 w-2.5" /> : "3"}
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">BNS Statutory Verification</p>
                    <p className="text-[10px] text-slate-500">
                      {verifiedList.length > 0 ? `${verifiedList.length} section(s) verified by police` : "Pending officer review"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5 ${
                    fir.status === "resolved" ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
                  }`}>
                    {fir.status === "resolved" ? <Check className="h-2.5 w-2.5" /> : "4"}
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">Final Case Disposition</p>
                    <p className="text-[10px] text-slate-500">
                      {fir.status === "resolved" ? "Resolved" : fir.status === "fake_fir" ? "Prosecuted Fake FIR" : "Investigation Active"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Legal Section Verification Center */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5 text-purple-600" />
                  <span>Statutory Legal Sections</span>
                </span>
                {verifiedList.length > 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Officer Verified</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Unverified
                  </span>
                )}
              </div>

              {/* Verified Sections List */}
              {verifiedList.length > 0 && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] font-bold text-emerald-950 uppercase tracking-wide flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Authoritative Sections (Verified by Police)</span>
                  </p>
                  <div className="space-y-1.5">
                    {verifiedList.map((entry, idx) => {
                      const sec = typeof entry === "object" ? entry.section : String(entry);
                      const act = (typeof entry === "object" && entry.act) || "BNS 2023";
                      const badge = (typeof entry === "object" && entry.verifiedByOfficerBadge) || fir.verified_by_badge || station?.officerBadge || "OFFICER";
                      const at = (typeof entry === "object" && entry.verifiedAt) || fir.verified_at;
                      return (
                        <div key={idx} className="bg-white border border-emerald-200 rounded-lg p-2 text-xs shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-emerald-900">{act} §{sec}</span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Verified</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Verified by Officer: <strong className="text-slate-800">{badge}</strong>
                            {at ? ` · ${new Date(at).toLocaleString("en-IN")}` : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI Suggested Sections */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    AI Suggestions (Unverified)
                  </p>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
                    Advisory
                  </span>
                </div>

                {canonical.legal.suggestedSections.length > 0 ? (
                  <div className="space-y-1.5">
                    {canonical.legal.suggestedSections.map((sec) => {
                      const isAlreadyVerified = verifiedSecCodes.has(sec);
                      return (
                        <div
                          key={sec}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 mr-2">BNS §{sec}</span>
                            <span className="text-[10px] text-slate-500">AI candidate</span>
                          </div>
                          {!isAlreadyVerified && (
                            <button
                              type="button"
                              onClick={() => handleVerifyLegalSection(sec)}
                              disabled={verifyingSec}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[10px] shadow-2xs transition cursor-pointer disabled:opacity-50"
                            >
                              Accept & Verify
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No AI suggestions pending.</p>
                )}
                <p className="text-[10px] text-slate-400 leading-tight">
                  * All statutory sections require Investigating Officer verification under <strong>BNSS §173</strong>.
                </p>
              </div>

              {/* Officer Manual Section Entry */}
              <div className="border-t border-slate-100 pt-2.5 space-y-2">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  Officer Manual Section Entry
                </p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={customSec}
                    onChange={(e) => setCustomSec(e.target.value)}
                    placeholder="Enter BNS § e.g. 303"
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleVerifyLegalSection(customSec)}
                    disabled={verifyingSec || !customSec.trim()}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-2xs transition cursor-pointer disabled:opacity-50"
                  >
                    {verifyingSec ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify §"}
                  </button>
                </div>
                {verifyMsg && (
                  <p className={`text-[11px] font-semibold ${verifyMsg.type === "success" ? "text-emerald-700" : "text-rose-600"}`}>
                    {verifyMsg.text}
                  </p>
                )}
              </div>
            </div>

            {/* Official Station Action Controls */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
                Official Action Controls
              </p>

              {/* Approve & Register FIR */}
              <button
                type="button"
                onClick={() => handleStatusChange("investigating")}
                disabled={updating || fir.status === "investigating"}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                <span>{fir.status === "investigating" ? "Investigation Underway" : "Approve & Register FIR"}</span>
              </button>

              {/* Mark Resolved */}
              <button
                type="button"
                onClick={() => handleStatusChange("resolved")}
                disabled={updating || fir.status === "resolved"}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Mark Case Resolved</span>
              </button>

              {/* Close Case */}
              <button
                type="button"
                onClick={() => handleStatusChange("closed")}
                disabled={updating || fir.status === "closed"}
                className="w-full py-2 rounded-xl border border-slate-300 hover:bg-slate-50 active:scale-98 text-slate-700 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
              >
                Close File
              </button>

              {/* Red Action: Flag Fake FIR */}
              <button
                type="button"
                onClick={() => onUpdateStatus(fir.id, "fake_fir")}
                className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Flag Malicious / Fake FIR</span>
              </button>

              {/* State DOCX Download */}
              <button
                type="button"
                onClick={() => onDownload(fir)}
                disabled={downloading}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
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
          className="fixed inset-0 z-60 bg-slate-950/85 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-xs"
        >
          <img src={activePhoto} alt="Enlarged Evidence" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl border border-white/20" />
        </div>
      )}
    </div>
  );
}
