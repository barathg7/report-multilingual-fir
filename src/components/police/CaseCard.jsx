// src/components/police/CaseCard.jsx — Fast Scanning Duty Officer Case Row
import {
  MapPin, ChevronRight, Download, Loader2, Camera, User,
  FileCheck, ShieldAlert, Mic, CheckCircle2, Clock, AlertTriangle
} from "lucide-react";
import { normalizeFIR, calculateCompleteness } from "@/lib/firSchema";

const STATUS_CONFIG = {
  submitted: {
    label: "New Submission",
    pill: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  investigating: {
    label: "Under Investigation",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  resolved: {
    label: "Resolved",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  closed: {
    label: "Closed File",
    pill: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  },
  fake_fir: {
    label: "⚠ Fake FIR (Prosecution)",
    pill: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-600",
  },
};

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

export default function CaseCard({
  fir,
  station,
  onSelect,
  onDownload,
  downloading,
}) {
  const canonical = normalizeFIR(fir);
  const completeness = calculateCompleteness(canonical);
  const isFake = fir.status === "fake_fir";
  const cfg = STATUS_CONFIG[fir.status] || STATUS_CONFIG.submitted;

  // Station distance
  const stationLat = station?.lat || station?.latitude;
  const stationLng = station?.lng || station?.longitude;
  const incLat = canonical.location.latitude;
  const incLng = canonical.location.longitude;
  const distance = haversineKm(stationLat, stationLng, incLat, incLng);

  // Verified sections check
  const verifiedCount =
    (Array.isArray(fir.verified_sections) && fir.verified_sections.length) ||
    (Array.isArray(canonical.legal.verifiedSections) && canonical.legal.verifiedSections.length) ||
    0;

  // Date formatting
  const dateStr = canonical.metadata.createdAt
    ? new Date(canonical.metadata.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recent";

  return (
    <div
      onClick={() => onSelect(fir)}
      className={`group cursor-pointer bg-white border rounded-2xl p-4 sm:p-5 transition-all duration-150 hover:shadow-md select-none relative ${
        isFake
          ? "border-rose-300/80 bg-rose-50/20 hover:border-rose-400"
          : "border-slate-200/90 hover:border-blue-400/80"
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

        {/* Left / Center Info */}
        <div className="space-y-2 flex-1 min-w-0">

          {/* Top identifiers row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-extrabold text-sm sm:text-base text-slate-950 tracking-tight break-all">
              {canonical.officialFIRNo
                ? `FIR #${canonical.officialFIRNo}`
                : canonical.submissionId
                ? `ACK: ${canonical.submissionId}`
                : canonical.id}
            </span>

            {/* Status Pill */}
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${cfg.pill}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              <span>{cfg.label}</span>
            </span>

            {/* Completeness Pill */}
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                completeness >= 80
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : completeness >= 50
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {completeness}% Complete
            </span>

            {/* Verified Sections Tag */}
            {verifiedCount > 0 && (
              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <FileCheck className="h-3 w-3 text-indigo-600" />
                <span>{verifiedCount} BNS § Verified</span>
              </span>
            )}

            {/* Timestamp */}
            <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto lg:ml-0 font-medium">
              <Clock className="h-3 w-3" />
              <span>{dateStr}</span>
            </span>
          </div>

          {/* Complainant & Incident Row */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-800 flex-wrap">
            <span className="font-bold text-slate-950">
              {canonical.complainant.name || "Anonymous / Unspecified"}
            </span>

            {canonical.complainant.phone && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-mono text-slate-600 text-xs">
                  {canonical.complainant.phone}
                </span>
              </>
            )}

            <span className="text-slate-300">·</span>
            <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-xs">
              {canonical.incident.crimeType || "Unclassified Offence"}
            </span>

            <span className="text-slate-300">·</span>
            <span className="text-slate-600 truncate max-w-xs sm:max-w-sm flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
              <span className="truncate">
                {canonical.location.address ||
                  canonical.incident.location ||
                  "Jurisdiction captured"}
              </span>
              {distance !== null && (
                <span className="text-[10px] font-bold text-blue-700 bg-blue-100/60 px-1.5 py-0.2 rounded shrink-0 ml-1">
                  {distance.toFixed(1)} km
                </span>
              )}
            </span>
          </div>

          {/* Incident statement snippet */}
          <p className="text-xs text-slate-600 italic line-clamp-1 leading-relaxed">
            "{canonical.incident.description ||
              canonical.incident.transcribedText ||
              "No citizen statement recorded."}"
          </p>

          {/* Evidence and dossier chips */}
          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
            {canonical.evidence.photos?.length > 0 && (
              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1 border border-slate-200">
                <Camera className="h-2.5 w-2.5 text-slate-500" />
                <span>{canonical.evidence.photos.length} Photos</span>
              </span>
            )}

            {(canonical.involved.suspects || canonical.evidence.sketchUrl) && (
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded flex items-center gap-1 border border-purple-200">
                <User className="h-2.5 w-2.5 text-purple-600" />
                <span>Suspect Profile</span>
              </span>
            )}

            {canonical.complainant.language && (
              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1 border border-slate-200">
                <Mic className="h-2.5 w-2.5 text-slate-500" />
                <span>Audio: {canonical.complainant.language}</span>
              </span>
            )}

            {canonical.signature?.imageData && (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1 border border-emerald-200">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                <span>Signed</span>
              </span>
            )}
          </div>

        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 self-end lg:self-center shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 w-full lg:w-auto justify-between lg:justify-start">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(fir);
            }}
            disabled={downloading}
            title="Download State Certified FIR DOCX"
            aria-label="Download State Certified FIR DOCX"
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition border border-slate-200 shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelect(fir)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold transition shadow-xs cursor-pointer group-hover:bg-blue-700 min-h-[44px]"
          >
            <span>Inspect Dossier</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
