// src/components/police/PoliceStatsRow.jsx — Command Center Stat Tiles
import { Inbox, FileClock, ShieldCheck, CheckCircle2, AlertOctagon } from "lucide-react";

export default function PoliceStatsRow({ counts, activeFilter, onSelectFilter }) {
  const items = [
    {
      id: "all",
      label: "Total Ledger",
      count: counts.total || 0,
      icon: Inbox,
      textColor: "text-slate-900",
      activeBg: "bg-slate-900 text-white border-slate-900 shadow-md",
      inactiveBg: "bg-white text-slate-900 border-slate-200/80 hover:border-slate-300",
      iconColor: "text-slate-600",
    },
    {
      id: "submitted",
      label: "New Submissions",
      count: counts.submitted || 0,
      icon: FileClock,
      pulse: counts.submitted > 0,
      textColor: "text-blue-900",
      activeBg: "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20",
      inactiveBg: "bg-blue-50/70 text-blue-950 border-blue-200/80 hover:border-blue-300",
      iconColor: "text-blue-600",
    },
    {
      id: "investigating",
      label: "Under Investigation",
      count: counts.investigating || 0,
      icon: ShieldCheck,
      textColor: "text-amber-900",
      activeBg: "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20",
      inactiveBg: "bg-amber-50/70 text-amber-950 border-amber-200/80 hover:border-amber-300",
      iconColor: "text-amber-600",
    },
    {
      id: "resolved",
      label: "Resolved Cases",
      count: counts.resolved || 0,
      icon: CheckCircle2,
      textColor: "text-emerald-900",
      activeBg: "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20",
      inactiveBg: "bg-emerald-50/70 text-emerald-950 border-emerald-200/80 hover:border-emerald-300",
      iconColor: "text-emerald-600",
    },
    {
      id: "fake_fir",
      label: "Prosecuted Fake",
      count: counts.fake || 0,
      icon: AlertOctagon,
      textColor: "text-rose-900",
      activeBg: "bg-rose-700 text-white border-rose-700 shadow-md shadow-rose-500/20",
      inactiveBg: "bg-rose-50/70 text-rose-950 border-rose-200/80 hover:border-rose-300",
      iconColor: "text-rose-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeFilter === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectFilter(item.id)}
            className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 cursor-pointer relative overflow-hidden group select-none ${
              isActive ? item.activeBg : item.inactiveBg
            }`}
          >
            {/* Top row: Icon + optional pulse indicator */}
            <div className="flex items-center justify-between mb-2">
              <span
                className={`p-1.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-white/80 border border-slate-200/60 " + item.iconColor
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>

              {item.pulse && (
                <span className="flex h-2.5 w-2.5 relative" title="Pending Action Required">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600" />
                </span>
              )}
            </div>

            {/* Metric Value */}
            <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight leading-none">
              {item.count}
            </p>

            {/* Label */}
            <p
              className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider mt-1.5 truncate ${
                isActive ? "text-white/90" : "opacity-75"
              }`}
            >
              {item.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
