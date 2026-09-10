// src/components/police/PoliceHeader.jsx — Official Police Command Center Header
import { Shield, RefreshCw, BarChart2, LogOut, Radio, UserCheck } from "lucide-react";

export default function PoliceHeader({
  station,
  loading,
  onRefresh,
  onLogout,
  onNavigateAnalytics,
}) {
  return (
    <header className="bg-slate-950 text-white px-4 sm:px-6 py-3.5 sticky top-0 z-30 shadow-lg border-b border-slate-800/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

        {/* Left: Station Identity & Emblem */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 flex items-center justify-center text-white shadow-md border border-blue-400/30">
              <Shield className="h-5 w-5 drop-shadow" />
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 shadow-xs"
              title="Secure Jurisdictional Terminal Active"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-extrabold text-sm sm:text-base text-white tracking-tight truncate">
                {station?.name || "Police Station Jurisdiction"}
              </h1>
              <span className="text-[11px] font-mono font-bold bg-blue-950/80 text-blue-300 px-2.5 py-0.5 rounded-md border border-blue-800/60 shadow-2xs">
                {station?.code || "STATION"}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                <Radio className="h-2.5 w-2.5 animate-pulse" />
                <span>Live Feed</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
              <span>{station?.district || "Jurisdiction"}, {station?.state || "Tamil Nadu"} Police</span>
              {station?.officerBadge && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="inline-flex items-center gap-1 text-slate-300 font-mono text-[11px]">
                    <UserCheck className="h-3 w-3 text-blue-400" />
                    <span>Officer: <strong>{station.officerBadge}</strong></span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            onClick={onNavigateAnalytics}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-200 text-xs font-semibold transition border border-slate-700/80 shadow-2xs cursor-pointer min-h-[38px]"
            title="View Crime & FIR Analytics"
            aria-label="View Crime and FIR Analytics"
          >
            <BarChart2 className="h-3.5 w-3.5 text-blue-400" />
            <span className="hidden md:inline">Crime Analytics</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            type="button"
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-300 hover:text-white transition border border-slate-700/80 shadow-2xs cursor-pointer disabled:opacity-50 min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="Synchronize Station Ledger"
            aria-label="Synchronize Station Ledger"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-blue-400" : ""}`} />
          </button>

          <button
            onClick={onLogout}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 active:scale-95 text-rose-300 text-xs font-semibold transition border border-rose-800/40 shadow-2xs cursor-pointer min-h-[38px]"
            title="End Station Shift & Log Out"
            aria-label="End Station Shift and Log Out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

      </div>
    </header>
  );
}
