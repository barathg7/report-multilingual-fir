// src/pages/Analytics.jsx
// FIXES: ✅ Station-scoped analytics, ✅ fake_fir in status breakdown, ✅ pulls from Supabase
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart2, TrendingUp, MapPin, ShieldAlert, FileText, ArrowLeft, RefreshCw, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function Analytics() {
  const navigate = useNavigate();
  const [firs,    setFirs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [station, setStation] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("police_station");
    if (!raw) { navigate("/#/police-login"); return; }
    const s = JSON.parse(raw);
    setStation(s);
    fetchFIRs(s);
  }, []);

  const fetchFIRs = async (s) => {
    setLoading(true);
    try {
      const code = s?.code || s?.station_code;
      let query = supabase.from("firs").select("*").order("created_at", { ascending: false });
      // Station-scoped: only show this station's FIRs in analytics
      if (code) query = query.eq("station_code", code);
      const { data, error } = await query;
      if (error) throw error;
      setFirs(data || []);
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Derived stats
  const crimeBreakdown = firs.reduce((a, f) => { const t = f.crime_type || "Unclassified"; a[t] = (a[t]||0)+1; return a; }, {});
  const ipcFreq        = firs.reduce((a, f) => { (f.ipc_sections||[]).forEach(s => { a[s]=(a[s]||0)+1; }); return a; }, {});
  const topIPC         = Object.entries(ipcFreq).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const thisMonth      = firs.filter(f => { const d=new Date(f.created_at); const n=new Date(); return d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear(); }).length;
  const mapped         = firs.filter(f => f.incident_latitude).length;
  const resolved       = firs.filter(f => f.status === "resolved").length;
  const pending        = firs.filter(f => f.status === "submitted").length;
  const fakeFIRs       = firs.filter(f => f.status === "fake_fir").length;

  const statCards = [
    { label: "Total FIRs",  value: firs.length,                        bg: "bg-blue-50",   text: "text-blue-700",   icon: FileText    },
    { label: "Crime Types", value: Object.keys(crimeBreakdown).length, bg: "bg-purple-50", text: "text-purple-700", icon: ShieldAlert },
    { label: "GPS Mapped",  value: mapped,                             bg: "bg-green-50",  text: "text-green-700",  icon: MapPin      },
    { label: "This Month",  value: thisMonth,                          bg: "bg-orange-50", text: "text-orange-700", icon: TrendingUp  },
    { label: "Resolved",    value: resolved,                           bg: "bg-emerald-50",text: "text-emerald-700",icon: CheckCircle },
    { label: "Pending",     value: pending,                            bg: "bg-red-50",    text: "text-red-700",    icon: Clock       },
    { label: "Fake FIRs",   value: fakeFIRs,                           bg: "bg-red-100",   text: "text-red-800",    icon: AlertTriangle},
  ];

  const monthlyTrend = (() => {
    const months = [];
    for (let i=5; i>=0; i--) {
      const d = new Date(); d.setMonth(d.getMonth()-i);
      const label = d.toLocaleString("default", { month: "short" });
      const count = firs.filter(f => { const fd=new Date(f.created_at); return fd.getMonth()===d.getMonth() && fd.getFullYear()===d.getFullYear(); }).length;
      months.push({ label, count });
    }
    return months;
  })();
  const maxTrend = Math.max(...monthlyTrend.map(m=>m.count), 1);

  const statusBreakdown = ["submitted","investigating","resolved","closed","fake_fir"].map(s => ({
    status: s, count: firs.filter(f=>f.status===s).length,
  }));
  const statusColors = { submitted:"bg-blue-500", investigating:"bg-yellow-500", resolved:"bg-green-500", closed:"bg-gray-400", fake_fir:"bg-red-600" };
  const statusLabels = { submitted:"Submitted", investigating:"Investigating", resolved:"Resolved", closed:"Closed", fake_fir:"⚠ Fake FIR" };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-10 w-10 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading analytics…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/#/police-dashboard")} className="text-blue-300 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-blue-300" />
            <div>
              <p className="font-bold text-sm">Crime Analytics</p>
              {station && <p className="text-blue-300 text-xs">{station.name} · {station.district}</p>}
            </div>
          </div>
        </div>
        <button onClick={() => station && fetchFIRs(station)} className="text-blue-300 hover:text-white">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Stat grid */}
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
          {statCards.map(({ label, value, icon: Icon, bg, text }) => (
            <div key={label} className={`${bg} rounded-2xl p-3 text-center`}>
              <Icon className={`h-4 w-4 ${text} mx-auto mb-1`} />
              <p className={`text-xl font-black ${text}`}>{value}</p>
              <p className={`text-xs ${text} opacity-70 leading-tight`}>{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Crime breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-4">Crime Type Breakdown</h2>
            {Object.keys(crimeBreakdown).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No data yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(crimeBreakdown).sort((a,b)=>b[1]-a[1]).map(([type, count]) => (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">{type}</span>
                      <span className="text-gray-500">{count} case{count>1?"s":""}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(count/firs.length)*100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top IPC */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-4">Top BNS / IPC Sections</h2>
            {topIPC.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">No IPC data yet</p> : (
              <div className="space-y-3">
                {topIPC.map(([section, count]) => (
                  <div key={section} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="font-bold text-blue-700 text-sm">§{section}</span>
                    <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">{count} case{count>1?"s":""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status breakdown — includes fake_fir */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-4">Case Status Overview</h2>
            <div className="space-y-3">
              {statusBreakdown.map(({ status, count }) => (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{statusLabels[status]}</span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`${statusColors[status]} h-2 rounded-full`}
                      style={{ width: firs.length ? `${(count/firs.length)*100}%` : "0%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly trend */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-4">Monthly FIR Trend (Last 6 Months)</h2>
            <div className="flex items-end justify-between gap-2 h-32">
              {monthlyTrend.map(({ label, count }) => (
                <div key={label} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-xs font-semibold text-gray-600">{count}</span>
                  <div className="w-full flex items-end justify-center">
                    <div className="w-full bg-blue-500 rounded-t-lg transition-all"
                      style={{ height: `${(count/maxTrend)*80}px`, minHeight: count>0?"4px":"0" }} />
                  </div>
                  <span className="text-xs text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-red-500" />
            <h2 className="font-bold text-gray-800">Incident Location Map</h2>
            <span className="ml-auto text-xs text-gray-400">{mapped} GPS-tagged incident{mapped!==1?"s":""}</span>
          </div>
          <iframe title="Crime Map"
            src="https://www.openstreetmap.org/export/embed.html?bbox=68.0,8.0,97.5,37.1&layer=mapnik"
            className="w-full border-0" style={{ height: 340 }} />
        </div>

      </div>
    </div>
  );
}