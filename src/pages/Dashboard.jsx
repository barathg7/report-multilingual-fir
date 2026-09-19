import { FileText, Plus, Clock, CheckCircle, AlertTriangle, BarChart2, Mic, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useFIRStore } from "@/hooks/useFIRStore";
import Badge from "@/components/ui/Badge";
import Card3D from "@/components/ui/Card3D";

const STATUS_COLOR = {
  submitted: "green",
  draft: "gray",
  pending_review: "yellow",
};

export default function Dashboard() {
  const { firs, isOnline, pendingCount } = useFIRStore();
  const recent = [...firs].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)).slice(0, 6);

  const stats = [
    {
      label: "Total FIRs Filed",
      value: firs.length,
      icon: FileText,
      gradient: "from-blue-600 to-indigo-600",
      glow: "rgba(37, 99, 235, 0.25)",
      textColor: "text-blue-600",
      bgSubtle: "bg-blue-50/80",
    },
    {
      label: "Submitted to Station",
      value: firs.filter((f) => f.status === "submitted").length,
      icon: CheckCircle,
      gradient: "from-emerald-600 to-teal-600",
      glow: "rgba(16, 185, 129, 0.25)",
      textColor: "text-emerald-600",
      bgSubtle: "bg-emerald-50/80",
    },
    {
      label: "Drafts in Progress",
      value: firs.filter((f) => f.status === "draft").length,
      icon: Clock,
      gradient: "from-amber-500 to-orange-600",
      glow: "rgba(245, 158, 11, 0.25)",
      textColor: "text-amber-600",
      bgSubtle: "bg-amber-50/80",
    },
    {
      label: "Offline Sync Queue",
      value: pendingCount,
      icon: AlertTriangle,
      gradient: "from-rose-600 to-red-700",
      glow: "rgba(225, 29, 72, 0.25)",
      textColor: "text-rose-600",
      bgSubtle: "bg-rose-50/80",
    },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto civic-mesh-bg min-h-full">
      {/* Offline Alert Banner with 3D Depth */}
      {!isOnline && (
        <div className="flex items-center gap-3 bg-amber-500/15 border border-amber-400/60 rounded-2xl p-4 text-sm text-amber-900 shadow-3d-card backdrop-blur-md">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="font-bold">Offline Resilience Mode Active</p>
            <p className="text-xs text-amber-800">
              Statements are encrypted and saved locally in browser storage. They will automatically sync to station servers when connectivity restores.
            </p>
          </div>
        </div>
      )}

      {/* Header Deck */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Command Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-wider">
              Citizen View
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Real-time Evidence Processing for Official Record Transcription · Tamil Nadu Police
          </p>
        </div>

        <Link
          to="/record-statement"
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-3d-button-primary hover:shadow-3d-glow-blue transition-all active:translate-y-0.5"
        >
          <Plus className="h-4 w-4" />
          <span>New FIR Statement</span>
        </Link>
      </div>

      {/* 3D Interactive Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, gradient, glow, textColor, bgSubtle }) => (
          <Card3D
            key={label}
            maxTilt={9}
            glowColor={glow}
            className="rounded-2xl"
          >
            <div className="p-5 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-3d-card hover:border-blue-300 transition-all flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                <div className={`w-9 h-9 rounded-xl ${bgSubtle} flex items-center justify-center ${textColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{value}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-semibold text-slate-400">Live Station State</span>
                </div>
              </div>
            </div>
          </Card3D>
        ))}
      </div>

      {/* Recent FIRs Deck */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight">Recent Statements</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {recent.length}
            </span>
          </div>
          {firs.length > 0 && (
            <Link
              to="/fir-history"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 transition-colors"
            >
              <span>View Full Registry</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-3xl bg-white/70 backdrop-blur-sm shadow-sm space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
            <h3 className="text-slate-800 font-extrabold text-lg">No FIR Records Filed Yet</h3>
            <p className="text-slate-500 text-xs sm:text-sm max-w-sm mx-auto">
              Start by recording a voice statement or entering incident facts to initiate your police complaint.
            </p>
            <Link
              to="/record-statement"
              className="inline-flex items-center gap-2 mt-2 px-6 py-3 bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-3d-button-primary hover:shadow-3d-glow-blue transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Record First Statement</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((fir) => (
              <Card3D
                key={fir.id}
                maxTilt={4}
                glowColor="rgba(56, 189, 248, 0.12)"
                className="rounded-2xl"
              >
                <div className="bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-3d-card hover:border-blue-300 transition-all">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 flex items-center justify-center shrink-0 text-blue-700 shadow-sm">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-extrabold text-slate-900 text-sm sm:text-base">
                          {fir.complainantName || "Citizen Complainant"}
                        </p>
                        <Badge color={STATUS_COLOR[fir.status] || "gray"}>
                          {fir.status?.replace("_", " ") || "draft"}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        <strong className="text-slate-700">{fir.crimeType || "General Grievance"}</strong> ·{" "}
                        {fir.incidentLocation || "Location Not Specified"} · {fir.incidentDate || "Date Pending"}
                      </p>
                      {fir.ipcSections?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Sections:</span>
                          {fir.ipcSections.map((s) => (
                            <span
                              key={s}
                              className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              §{s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 text-right shrink-0">
                    <span className="text-[11px] font-mono text-slate-400">
                      {fir.savedAt ? new Date(fir.savedAt).toLocaleDateString("en-IN") : ""}
                    </span>
                    <Link
                      to="/fir-history"
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                    >
                      <span>View Dossier</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </Card3D>
            ))}
          </div>
        )}
      </div>

      {/* 3D Action Modules Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <Link
          to="/record-statement"
          className="p-5 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white shadow-3d-button-primary hover:shadow-3d-glow-blue flex items-center gap-4 transition-all hover:-translate-y-0.5"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <p className="font-extrabold text-sm">Voice Statement</p>
            <p className="text-[11px] text-blue-200">Audio capture in 40+ languages</p>
          </div>
        </Link>

        <Link
          to="/fir-history"
          className="p-5 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 text-slate-800 shadow-3d-card hover:border-blue-300 flex items-center gap-4 transition-all hover:-translate-y-0.5"
        >
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="font-extrabold text-sm">FIR Archive</p>
            <p className="text-[11px] text-slate-400">Search and track lodged reports</p>
          </div>
        </Link>

        <Link
          to="/analytics"
          className="p-5 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 text-slate-800 shadow-3d-card hover:border-blue-300 flex items-center gap-4 transition-all hover:-translate-y-0.5"
        >
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <BarChart2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-extrabold text-sm">Crime Intelligence</p>
            <p className="text-[11px] text-slate-400">Station trends and legal analytics</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
