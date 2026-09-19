import { useNavigate } from "react-router-dom";
import {
  Shield,
  FileText,
  AlertOctagon,
  ArrowRight,
  Radio,
  Lock,
  History,
  Sparkles,
} from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  const handleSOSClick = () => {
    window.dispatchEvent(new CustomEvent("open-sos-panel"));
  };

  return (
    <div className="min-h-screen flex flex-col justify-between font-sans selection:bg-blue-600 selection:text-white relative overflow-x-hidden civic-mesh-bg text-slate-900">

      {/* Ambient background glow */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[130px]" />
        <div className="absolute bottom-10 right-1/4 w-[450px] h-[450px] rounded-full bg-rose-500/10 blur-[140px]" />
        <div className="absolute inset-0 hologram-grid opacity-40" />
      </div>

      {/* ── Top Bar / Minimal Header ── */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Official Digital Reporting System · Tamil Nadu Police</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="nav-track-complaint"
            onClick={() => navigate("/fir-history")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700 px-3 py-2 rounded-xl hover:bg-white/80 transition-all min-h-[40px]"
            title="Track status of previously submitted complaints"
          >
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>Track Complaint</span>
          </button>
        </div>
      </header>

      {/* ── Main Centered Action Hub ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 max-w-2xl mx-auto w-full text-center">

        {/* Brand Emblem & Header */}
        <div className="flex flex-col items-center space-y-4 mb-10">
          {/* Glowing 3D Shield Emblem */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center shadow-3d-button-primary border border-cyan-400/40 relative group">
            <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
            <div className="absolute -inset-1 rounded-3xl bg-cyan-400/20 blur-sm -z-10 group-hover:bg-cyan-400/30 transition-colors" />
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl sm:text-6xl font-black text-slate-950 tracking-tight flex items-center justify-center gap-3">
              REPORT
            </h1>
            <p className="text-sm sm:text-base font-bold text-slate-600 max-w-md mx-auto">
              AI-Powered Multilingual Digital Police Complaint &amp; Emergency System
            </p>
            <p className="text-xs text-slate-400 font-medium">
              தமிழ் · English · हिन्दी · and 40+ Languages Supported
            </p>
          </div>
        </div>

        {/* Action Hub Cards (Exact Diagram Architecture) */}
        <div className="w-full max-w-md space-y-4">

          {/* 1. Large Citizen Portal Primary Button */}
          <button
            id="cta-file-complaint"
            onClick={() => navigate("/record-statement")}
            className="group w-full flex items-center justify-between p-5 sm:p-6 rounded-2xl sm:rounded-3xl
              bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 hover:from-blue-800 hover:to-indigo-800
              text-white shadow-3d-button-primary hover:shadow-3d-glow-blue active:translate-y-0.5
              transition-all duration-200 cursor-pointer min-h-[76px] text-left border border-blue-400/30"
            aria-label="Enter Citizen Portal to file an official complaint in 4 simple pages"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 shadow-inner">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-0.5">
                <div className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                  <span>Citizen Portal</span>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950">
                    4 Steps
                  </span>
                </div>
                <p className="text-xs text-blue-100/90 font-medium">
                  File an official complaint or FIR statement
                </p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-all shrink-0 ml-2">
              <ArrowRight className="w-5 h-5 text-white transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* 2. Large SOS / Emergency Action Button */}
          <button
            id="sos-trigger-landing"
            onClick={handleSOSClick}
            className="group w-full flex items-center justify-between p-5 sm:p-6 rounded-2xl sm:rounded-3xl
              bg-gradient-to-r from-rose-700 via-red-600 to-rose-800 hover:from-rose-800 hover:to-red-700
              text-white shadow-3d-button-danger hover:shadow-3d-glow-rose active:translate-y-0.5
              transition-all duration-200 cursor-pointer min-h-[76px] text-left border border-rose-400/40 relative overflow-hidden"
            aria-label="Trigger Immediate Emergency SOS. Transmits live coordinates and audio to police dispatch"
          >
            {/* Subtle radar pulse effect */}
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />

            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                <AlertOctagon className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                  <span>SOS / EMERGENCY</span>
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-white text-rose-700">
                    <Radio className="w-2.5 h-2.5 text-rose-600 animate-pulse" />
                    Instant
                  </span>
                </div>
                <p className="text-xs text-rose-100/90 font-medium">
                  Immediate danger · Live GPS &amp; police dispatch
                </p>
              </div>
            </div>

            <div className="w-10 h-10 rounded-full bg-white/15 group-hover:bg-white/25 flex items-center justify-center transition-all shrink-0 ml-2 relative z-10">
              <Radio className="w-5 h-5 text-white" />
            </div>
          </button>

          {/* Emergency Hotkey Notice */}
          <p className="text-[11px] text-slate-400 font-medium pt-1">
            Quick trigger: Press <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-mono font-bold">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-mono font-bold">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-mono font-bold">E</kbd> anywhere
          </p>

        </div>

      </main>

      {/* ── Discrete Footer: Police Access Only (Separate Flow) ── */}
      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-blue-600" />
          <span>BNS 2023 Compliant · Jurisdictional Station Triangulation</span>
        </div>

        {/* Dedicated Police Entry Link */}
        <div className="flex items-center gap-4">
          <button
            id="nav-police-portal"
            onClick={() => navigate("/police-login")}
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-blue-800 font-semibold px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Official Police Portal →</span>
          </button>
        </div>
      </footer>

    </div>
  );
}
