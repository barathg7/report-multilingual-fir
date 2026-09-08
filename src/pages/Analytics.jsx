// src/pages/Analytics.jsx — Station-Scoped Crime Analytics & Workload Intelligence
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart2, TrendingUp, MapPin, ShieldAlert, FileText,
  ArrowLeft, RefreshCw, Clock, CheckCircle, AlertTriangle,
  Scale, Shield
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { loadFromStorage } from "@/utils";
import { toSupabaseRow } from "@/lib/firSchema";

export default function Analytics() {
  const navigate = useNavigate();
  const [firs,    setFirs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [station, setStation] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("police_station");
    if (!raw) {
      navigate("/police-login");
      return;
    }
    const s = JSON.parse(raw);
    setStation(s);
    fetchStationFIRs(s);
  }, [navigate]);

  const fetchStationFIRs = async (s) => {
    setLoading(true);
    try {
      const stationCode = (s.code || s.station_code || "").trim();
      const stationName = (s.name || "").trim().toLowerCase();

      // 1. Fetch from Supabase
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
        console.warn("Analytics remote query error:", e.message);
      }

      // 2. Fetch from Local Store
      const localStored = loadFromStorage("report_firs", []);
      const normalizedLocal = Array.isArray(localStored) ? localStored.map(toSupabaseRow) : [];

      // Merge and deduplicate
      const map = new Map();
      remoteFIRs.forEach(f => map.set(f.id, f));
      normalizedLocal.forEach(f => {
        if (!map.has(f.id)) map.set(f.id, f);
      });

      const all = Array.from(map.values());

      // Filter station-scoped
      const filtered = all.filter(fir => {
        const code = (fir.station_code || "").trim();
        const name = (fir.station_name || "").trim().toLowerCase();
        if (stationCode && code && code.toLowerCase() === stationCode.toLowerCase()) return true;
        if (stationName && name && name.includes(stationName)) return true;
        return all.length <= 5; // fallback in dev mode
      });

      setFirs(filtered);
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Derived calculations
  const crimeBreakdown = firs.reduce((a, f) => {
    const t = f.crime_type || f.crimeType || "Unclassified";
    a[t] = (a[t] || 0) + 1;
    return a;
  }, {});

  const ipcFreq = firs.reduce((a, f) => {
    const sections = f.ipc_sections || f.ipcSections || [];
    sections.forEach(s => {
      const clean = String(s).replace(/^§/, "").trim();
      if (clean) a[clean] = (a[clean] || 0) + 1;
    });
    return a;
  }, {});

  const topIPC = Object.entries(ipcFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const thisMonth = firs.filter(f => {
    if (!f.created_at) return false;
    const d = new Date(f.created_at);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  const mapped   = firs.filter(f => f.incident_latitude && f.incident_longitude).length;
  const resolved = firs.filter(f => f.status === "resolved").length;
  const pending  = firs.filter(f => f.status === "submitted").length;
  const active   = firs.filter(f => f.status === "investigating").length;
  const fakeFIRs = firs.filter(f => f.status === "fake_fir").length;

  const statCards = [
    { label: "Total Complaints", value: firs.length, bg: "bg-white border-slate-200", text: "text-slate-900", icon: FileText },
    { label: "Crime Types", value: Object.keys(crimeBreakdown).length, bg: "bg-purple-50/70 border-purple-200", text: "text-purple-900", icon: ShieldAlert },
    { label: "GPS Mapped", value: mapped, bg: "bg-blue-50/70 border-blue-200", text: "text-blue-900", icon: MapPin },
    { label: "This Month", value: thisMonth, bg: "bg-indigo-50/70 border-indigo-200", text: "text-indigo-900", icon: TrendingUp },
    { label: "Under Investigation", value: active, bg: "bg-amber-50/70 border-amber-200", text: "text-amber-900", icon: Clock },
    { label: "Resolved", value: resolved, bg: "bg-emerald-50/70 border-emerald-200", text: "text-emerald-900", icon: CheckCircle },
    { label: "Prosecuted Fake", value: fakeFIRs, bg: "bg-rose-50/70 border-rose-200", text: "text-rose-900", icon: AlertTriangle },
  ];

  const monthlyTrend = (() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString("default", { month: "short" });
      const count = firs.filter(f => {
        if (!f.created_at) return false;
        const fd = new Date(f.created_at);
        return fd.getMonth() === d.getMonth() && fd.getFullYear() === d.getFullYear();
      }).length;
      months.push({ label, count });
    }
    return months;
  })();
  const maxTrend = Math.max(...monthlyTrend.map(m => m.count), 1);

  const statusBreakdown = [
    { status: "submitted", label: "Submitted", color: "bg-blue-500", count: pending },
    { status: "investigating", label: "Investigating", color: "bg-amber-500", count: active },
    { status: "resolved", label: "Resolved", color: "bg-emerald-500", count: resolved },
    { status: "closed", label: "Closed", color: "bg-slate-400", count: firs.filter(f => f.status === "closed").length },
    { status: "fake_fir", label: "Fake FIR", color: "bg-rose-600", count: fakeFIRs },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-slate-600 text-xs font-semibold">Aggregating station crime intelligence…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/police-dashboard")}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Back to Station Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <BarChart2 className="h-4 w-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm sm:text-base text-white">Station Crime Analytics</h1>
              {station && <p className="text-slate-400 text-xs">{station.name} · {station.district}</p>}
            </div>
          </div>
        </div>

        <button
          onClick={() => station && fetchStationFIRs(station)}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
          title="Refresh Data"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
        
        {/* Stat Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {statCards.map(({ label, value, icon: Icon, bg, text }) => (
            <div key={label} className={`${bg} border rounded-2xl p-3.5 text-center shadow-2xs`}>
              <Icon className={`h-4 w-4 ${text} mx-auto mb-1 opacity-80`} />
              <p className={`text-2xl font-black ${text}`}>{value}</p>
              <p className={`text-[11px] font-semibold ${text} opacity-75 mt-0.5 leading-tight`}>{label}</p>
            </div>
          ))}
        </div>

        {firs.length === 0 ? (
          /* Honest Empty State when No Data Exists */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-2xs">
            <BarChart2 className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">Not Enough Station Data Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              No complaint records exist yet for <strong>{station?.name}</strong> ({station?.code}).
              Workload distributions, crime categorization, and BNS analytics will populate here as citizen complaints are filed.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Visual Analytics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Crime Type Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h2 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-purple-600" />
                    <span>Crime Category Breakdown</span>
                  </h2>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {Object.keys(crimeBreakdown).length} Categories
                  </span>
                </div>

                <div className="space-y-3">
                  {Object.entries(crimeBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => (
                      <div key={type} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-800">{type}</span>
                          <span className="text-slate-500">{count} case{count > 1 ? "s" : ""} ({Math.round((count / firs.length) * 100)}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-purple-600 h-full rounded-full transition-all"
                            style={{ width: `${(count / firs.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Top BNS Sections */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h2 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Scale className="h-4 w-4 text-blue-600" />
                    <span>Top BNS 2023 Sections Charged</span>
                  </h2>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Station Ledger
                  </span>
                </div>

                {topIPC.length === 0 ? (
                  <p className="text-slate-400 text-xs text-center py-8 italic">No sections charged yet</p>
                ) : (
                  <div className="space-y-2.5">
                    {topIPC.map(([section, count]) => (
                      <div
                        key={section}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                      >
                        <span className="font-bold text-blue-700 text-sm">BNS §{section}</span>
                        <span className="bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full text-xs">
                          {count} {count === 1 ? "occurrence" : "occurrences"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Case Status Overview */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h2 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>Station Resolution Pipeline</span>
                  </h2>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {firs.length} Total
                  </span>
                </div>

                <div className="space-y-3">
                  {statusBreakdown.map(({ status, label, color, count }) => (
                    <div key={status} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-800">{label}</span>
                        <span className="text-slate-500">{count}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`${color} h-full rounded-full transition-all`}
                          style={{ width: firs.length ? `${(count / firs.length) * 100}%` : "0%" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly Trend Bar Chart */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h2 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-indigo-600" />
                    <span>Monthly Filing Trend (6 Months)</span>
                  </h2>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Recent
                  </span>
                </div>

                <div className="flex items-end justify-between gap-2 h-36 pt-4">
                  {monthlyTrend.map(({ label, count }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 flex-1">
                      <span className="text-[10px] font-bold text-slate-600">{count}</span>
                      <div className="w-full flex items-end justify-center h-24">
                        <div
                          className="w-full bg-blue-600 hover:bg-blue-700 rounded-t-lg transition-all"
                          style={{
                            height: `${(count / maxTrend) * 90}%`,
                            minHeight: count > 0 ? "6px" : "0",
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Jurisdiction Incident Map Frame */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-rose-600" />
                  <h2 className="font-bold text-sm text-slate-900">Jurisdiction Hotspot Geo-Map</h2>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {mapped} GPS-tagged incident{mapped !== 1 ? "s" : ""}
                </span>
              </div>
              <iframe
                title="Jurisdiction Crime Hotspot Map"
                src="https://www.openstreetmap.org/export/embed.html?bbox=68.0,8.0,97.5,37.1&layer=mapnik"
                className="w-full border-0"
                style={{ height: 320 }}
              />
            </div>

          </div>
        )}

      </main>
    </div>
  );
}