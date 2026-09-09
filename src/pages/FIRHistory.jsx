import { useState } from "react";
import { FileText, Search, Trash2, Eye, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useFIRStore } from "@/hooks/useFIRStore";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";

const STATUS_COLOR = { submitted: "green", draft: "gray", pending_review: "yellow" };

export default function FIRHistory() {
  const { firs, deleteFIR } = useFIRStore();
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");
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
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" /> FIR History
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{firs.length} total records</p>
        </div>
        <Link to="/record-statement" className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New FIR
        </Link>
      </div>

      {/* Search & filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, crime type, FIR ID or location..."
            className="w-full h-10 border border-gray-300 rounded-xl pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Status</option>
          <option value="submitted">Submitted</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
          <FileText className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{search ? "No matching FIRs" : "No FIRs yet"}</p>
          <p className="text-gray-400 text-sm mt-1">{search ? "Try a different search" : "File your first FIR to get started"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((fir) => (
            <div key={fir.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Row */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="bg-blue-50 rounded-xl p-2.5 shrink-0">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 truncate">{fir.complainantName || "Unknown"}</p>
                      <Badge color={STATUS_COLOR[fir.status] || "gray"}>{fir.status || "draft"}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {fir.crimeType || "Unknown crime"} · {fir.incidentLocation || "—"} · {fir.incidentDate || "—"}
                    </p>
                    <p className="text-xs font-mono text-blue-500 mt-0.5">
                      {fir.officialFIRNo ? `FIR: ${fir.officialFIRNo}` : (fir.submissionId || fir.id)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button onClick={() => setExpanded(expanded === fir.id ? null : fir.id)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button onClick={() => { if (confirm("Delete this FIR?")) deleteFIR(fir.id); }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expanded === fir.id && (
                <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-2 text-sm">
                  {[
                    ["Language",        fir.language],
                    ["Phone",           fir.complainantPhone],
                    ["IPC Sections",    fir.ipcSections?.map((s) => `§${s}`).join(", ")],
                    ["Description",     fir.incidentDescription],
                    ["GPS Coordinates", fir.incidentLatitude ? `${fir.incidentLatitude.toFixed(5)}, ${fir.incidentLongitude.toFixed(5)}` : null],
                    ["Photos",          fir.evidencePhotos?.length ? `${fir.evidencePhotos.length} photo(s)` : null],
                    ["Sketch",          fir.suspectSketchUrl ? "AI Sketch Generated" : null],
                    ["Saved At",        fir.savedAt ? new Date(fir.savedAt).toLocaleString("en-IN") : null],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="flex gap-3">
                      <span className="text-gray-500 w-36 shrink-0 font-medium">{label}</span>
                      <span className="text-gray-800">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
