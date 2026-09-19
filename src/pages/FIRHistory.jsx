import { useState } from "react";
import { FileText, Search, Trash2, Eye, Plus, ShieldCheck, ChevronDown, ChevronUp, MapPin, Calendar, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { useFIRStore } from "@/hooks/useFIRStore";
import Badge from "@/components/ui/Badge";
import Card3D from "@/components/ui/Card3D";

const STATUS_COLOR = {
  submitted: "green",
  draft: "gray",
  pending_review: "yellow",
};

export default function FIRHistory() {
  const { firs, deleteFIR } = useFIRStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  const filtered = firs
    .filter((f) => filter === "all" || f.status === filter)
    .filter((f) => {
      const q = search.toLowerCase();
      return (
        !q ||
        f.complainantName?.toLowerCase().includes(q) ||
        f.crimeType?.toLowerCase().includes(q) ||
        f.id?.toLowerCase().includes(q) ||
        f.submissionId?.toLowerCase().includes(q) ||
        f.officialFIRNo?.toLowerCase().includes(q) ||
        f.incidentLocation?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

  return (
    <div className="p-6 md:p-8 space-y-7 max-w-5xl mx-auto civic-mesh-bg min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-700 shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                FIR Case Registry
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                Official Digital Archive · {firs.length} Total Incident Record(s)
              </p>
            </div>
          </div>
        </div>

        <Link
          to="/record-statement"
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold shadow-3d-button-primary hover:shadow-3d-glow-blue transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Lodge New Statement</span>
        </Link>
      </div>

      {/* Search & Filter Dock */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by complainant, incident type, location, FIR number…"
            className="w-full h-12 border border-slate-200/90 rounded-2xl pl-11 pr-4 text-sm bg-white/90 backdrop-blur-md shadow-3d-card focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
          />
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-12 border border-slate-200/90 rounded-2xl px-4 text-sm font-semibold bg-white/90 backdrop-blur-md shadow-3d-card focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700 cursor-pointer"
        >
          <option value="all">All Jurisdictional Statuses</option>
          <option value="submitted">Submitted to Station</option>
          <option value="draft">Draft / Incomplete</option>
        </select>
      </div>

      {/* Registry List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-3xl bg-white/60 backdrop-blur-sm space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto shadow-inner">
            <FileText className="h-8 w-8 text-blue-400" />
          </div>
          <p className="text-slate-800 font-extrabold text-base">
            {search ? "No Matching Records Found" : "Registry Empty"}
          </p>
          <p className="text-slate-400 text-xs sm:text-sm max-w-sm mx-auto">
            {search
              ? "Try adjusting your search query or jurisdiction filter parameters."
              : "No FIR statements have been recorded in this terminal session yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((fir) => {
            const isExp = expanded === fir.id;
            return (
              <Card3D
                key={fir.id}
                maxTilt={3}
                glowColor="rgba(56, 189, 248, 0.12)"
                className="rounded-2xl"
              >
                <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-3d-card hover:border-blue-300 transition-all overflow-hidden">
                  {/* Primary Row */}
                  <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center shrink-0 text-blue-700 shadow-sm">
                        <FileText className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <p className="font-extrabold text-slate-900 text-sm sm:text-base truncate">
                            {fir.complainantName || "Anonymous Complainant"}
                          </p>
                          <Badge color={STATUS_COLOR[fir.status] || "gray"}>
                            {fir.status || "draft"}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                          <span className="font-bold text-slate-700">{fir.crimeType || "Incident Grievance"}</span>
                          <span>·</span>
                          <span className="truncate">{fir.incidentLocation || "Location Pending"}</span>
                          <span>·</span>
                          <span>{fir.incidentDate || "Date Pending"}</span>
                        </div>

                        <p className="text-[11px] font-mono font-bold text-blue-600">
                          {fir.officialFIRNo ? `CASE ID: ${fir.officialFIRNo}` : (fir.submissionId || fir.id)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setExpanded(isExp ? null : fir.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isExp
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                        }`}
                        title={isExp ? "Collapse details" : "Inspect case dossier"}
                      >
                        {isExp ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>

                      <button
                        onClick={() => {
                          if (confirm("Delete this FIR record from local storage?")) {
                            deleteFIR(fir.id);
                          }
                        }}
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* 3D Dossier Details Expanded */}
                  {isExp && (
                    <div className="border-t border-slate-100 px-5 py-5 bg-gradient-to-b from-slate-50/70 to-blue-50/20 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {[
                          ["Language / Dialect", fir.language || "English"],
                          ["Complainant Phone", fir.complainantPhone ? `+91 ${fir.complainantPhone}` : "Not Provided"],
                          [
                            "BNS / IPC Sections",
                            fir.ipcSections?.length
                              ? fir.ipcSections.map((s) => `§${s}`).join(", ")
                              : "No Sections Assigned",
                          ],
                          [
                            "GPS Coordinates",
                            fir.incidentLatitude
                              ? `${fir.incidentLatitude.toFixed(5)}, ${fir.incidentLongitude.toFixed(5)}`
                              : "Coordinates Pending",
                          ],
                          [
                            "Photographic Evidence",
                            fir.evidencePhotos?.length ? `${fir.evidencePhotos.length} Attached file(s)` : "None",
                          ],
                          [
                            "Digital Signature",
                            fir.signatureData ? "Verified Cryptographic Signature" : "Unsigned",
                          ],
                          [
                            "Filing Timestamp",
                            fir.savedAt ? new Date(fir.savedAt).toLocaleString("en-IN") : "Unknown",
                          ],
                        ].map(([label, val]) => (
                          <div
                            key={label}
                            className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between"
                          >
                            <span className="font-bold text-slate-500">{label}</span>
                            <span className="font-semibold text-slate-800 font-mono">{val}</span>
                          </div>
                        ))}
                      </div>

                      {fir.incidentDescription && (
                        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-1">
                          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                            Incident Narrative Transcript
                          </p>
                          <p className="text-xs text-slate-700 leading-relaxed font-sans">
                            {fir.incidentDescription}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card3D>
            );
          })}
        </div>
      )}
    </div>
  );
}
