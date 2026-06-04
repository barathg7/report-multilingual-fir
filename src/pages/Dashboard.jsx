import { FileText, Plus, Clock, CheckCircle, AlertTriangle, BarChart2, Mic } from "lucide-react";
import { Link } from "react-router-dom";
import { useFIRStore } from "@/hooks/useFIRStore";
import Badge from "@/components/ui/Badge";

const STATUS_COLOR = { submitted: "green", draft: "gray", pending_review: "yellow" };

export default function Dashboard() {
  const { firs, isOnline, pendingCount } = useFIRStore();
  const recent = [...firs].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)).slice(0, 6);

  const stats = [
    { label: "Total FIRs",    value: firs.length,                                        icon: FileText,     bg: "bg-blue-50",   text: "text-blue-700",   icon2: "text-blue-500"   },
    { label: "Submitted",     value: firs.filter((f) => f.status === "submitted").length, icon: CheckCircle,  bg: "bg-green-50",  text: "text-green-700",  icon2: "text-green-500"  },
    { label: "Drafts",        value: firs.filter((f) => f.status === "draft").length,     icon: Clock,        bg: "bg-yellow-50", text: "text-yellow-700", icon2: "text-yellow-500" },
    { label: "Offline Queue", value: pendingCount,                                        icon: AlertTriangle, bg: "bg-red-50",   text: "text-red-700",    icon2: "text-red-500"    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          You are offline — FIRs are saved locally and will sync when connected.
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">REPORT — Tamil Nadu Police FIR System</p>
        </div>
        <Link
          to="/record-statement"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> New FIR
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, bg, text, icon2 }) => (
          <div key={label} className={`${bg} rounded-2xl p-5 border border-white`}>
            <Icon className={`h-6 w-6 ${icon2} mb-3`} />
            <p className={`text-3xl font-black ${text}`}>{value}</p>
            <p className={`text-xs ${text} opacity-70 mt-1`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Recent FIRs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 text-lg">Recent FIRs</h2>
          {firs.length > 0 && (
            <Link to="/fir-history" className="text-sm text-blue-600 hover:underline font-medium">View all →</Link>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
            <FileText className="h-14 w-14 mx-auto text-gray-200 mb-4" />
            <p className="text-gray-500 font-semibold text-lg">No FIRs filed yet</p>
            <p className="text-gray-400 text-sm mt-1">Start by recording a complaint statement</p>
            <Link
              to="/record-statement"
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> File First FIR
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((fir) => (
              <div key={fir.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-50 rounded-xl p-2.5 shrink-0">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{fir.complainantName || "Unknown Complainant"}</p>
                      <Badge color={STATUS_COLOR[fir.status] || "gray"}>
                        {fir.status?.replace("_", " ") || "draft"}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fir.crimeType || "Unknown crime"} · {fir.incidentLocation || "Location not set"} · {fir.incidentDate || "Date not set"}
                    </p>
                    {fir.ipcSections?.length > 0 && (
                      <p className="text-xs text-blue-600 mt-0.5">IPC: {fir.ipcSections.map((s) => `§${s}`).join(", ")}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-xs text-gray-400">{fir.savedAt ? new Date(fir.savedAt).toLocaleDateString("en-IN") : ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { to: "/record-statement", icon: Mic,      label: "New FIR",     cls: "bg-blue-600 text-white hover:bg-blue-700" },
          { to: "/fir-history",      icon: FileText,  label: "FIR History", cls: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50" },
          { to: "/analytics",        icon: BarChart2, label: "Analytics",   cls: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50" },
        ].map(({ to, icon: Icon, label, cls }) => (
          <Link key={to} to={to} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors ${cls}`}>
            <Icon className="h-4 w-4" />{label}
          </Link>
        ))}
      </div>
    </div>
  );
}

