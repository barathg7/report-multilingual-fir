import { useNavigate } from "react-router-dom";
import {
  Shield,
  FileText,
  Lock,
  ArrowRight,
  Mic,
  Globe2,
  AlertOctagon,
  Building2,
  UserCheck,
  Fingerprint,
  ChevronRight,
  Radio,
  Sparkles,
  Layers,
  Cpu,
} from "lucide-react";
import ThreeShieldHologram from "@/components/ui/ThreeShieldHologram";
import Card3D from "@/components/ui/Card3D";

const HIGHLIGHT_LANGUAGES = [
  { native: "தமிழ்",   english: "Tamil"     },
  { native: "हिन्दी",   english: "Hindi"     },
  { native: "English",  english: "English"   },
  { native: "తెలుగు",  english: "Telugu"    },
  { native: "ಕನ್ನಡ",   english: "Kannada"   },
  { native: "മലയാളം",  english: "Malayalam" },
  { native: "मराठी",   english: "Marathi"   },
  { native: "বাংলা",   english: "Bengali"   },
  { native: "ગુજરાતી", english: "Gujarati"  },
  { native: "ਪੰਜਾਬੀ",  english: "Punjabi"   },
];

const TRUST_BADGES = [
  { label: "BNS 2023 Compliant",      icon: FileText,    color: "text-blue-500" },
  { label: "End-to-End Encrypted",    icon: Fingerprint, color: "text-cyan-500" },
  { label: "3,500+ Jurisdictions",    icon: Building2,   color: "text-emerald-500" },
  { label: "40+ Languages Supported", icon: Globe2,      color: "text-indigo-500" },
];

const FEATURE_PILLARS = [
  {
    icon: Mic,
    bg:   "bg-blue-500/10 border border-blue-500/20 text-blue-600",
    glow: "rgba(59, 130, 246, 0.2)",
    title: "Voice-First Reporting",
    desc:  "Speak naturally in your dialect. Advanced AI captures, cleans, and transcribes spoken audio into an official record in real-time.",
  },
  {
    icon: Cpu,
    bg:   "bg-indigo-500/10 border border-indigo-500/20 text-indigo-600",
    glow: "rgba(99, 102, 241, 0.2)",
    title: "BNS 2023 Neural Mapping",
    desc:  "AI analyzes your narrative to recommend accurate legal sections under Bharatiya Nyaya Sanhita with legal citations.",
  },
  {
    icon: Building2,
    bg:   "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600",
    glow: "rgba(16, 185, 129, 0.2)",
    title: "Station GPS Jurisdiction",
    desc:  "High-precision geospatial triangulation routes your statement to the exact local police station across 3,500+ stations.",
  },
  {
    icon: FileText,
    bg:   "bg-amber-500/10 border border-amber-500/20 text-amber-600",
    glow: "rgba(245, 158, 11, 0.2)",
    title: "Certified State DOCX",
    desc:  "Exports official bilingual FIR documents with digital verification ready for judicial submission and station intake.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  const handleSOSClick = () => {
    window.dispatchEvent(new CustomEvent("open-sos-panel"));
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-blue-600 selection:text-white relative overflow-x-hidden civic-mesh-bg">

      {/* ── AMBIENT 3D MESH & RADAR BACKGROUND ── */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        {/* Deep background ambient glowing spheres */}
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[120px] animate-pulse-slow" />
        <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full bg-cyan-400/10 blur-[130px] animate-pulse-slow" />
        <div className="absolute -bottom-40 left-1/4 w-[650px] h-[650px] rounded-full bg-indigo-600/10 blur-[140px]" />

        {/* Spatial Hologram Grid */}
        <div className="absolute inset-0 hologram-grid opacity-60" />
      </div>

      {/* ── STICKY GLASSMORPHIC CYBER NAV ── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 shadow-3d-card ambient-lighting">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

          {/* Brand lockup with 3D Tactile Emblem */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center shadow-3d-button-primary border border-cyan-400/30">
              <Shield className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            </div>
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base text-slate-900 tracking-tight">REPORT</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 uppercase">
                  3D AI
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5">
                Tamil Nadu Police System
              </span>
            </div>
          </div>

          {/* Nav actions */}
          <nav className="flex items-center gap-2">
            <button
              id="nav-citizen-login"
              onClick={() => navigate("/citizen-login")}
              className="text-xs font-semibold text-slate-600 hover:text-blue-700 px-3.5 py-2 rounded-xl hover:bg-blue-50/70 transition-all min-h-[40px] flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              Citizen Login
            </button>
            <button
              id="nav-track-complaint"
              onClick={() => navigate("/fir-history")}
              className="hidden sm:inline-flex text-xs font-semibold text-slate-600 hover:text-slate-900 px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-colors min-h-[40px]"
            >
              Track Complaint
            </button>
            <button
              id="nav-police-portal"
              onClick={() => navigate("/police-login")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800
                hover:text-blue-700 px-3.5 py-2 rounded-xl border border-slate-200/90
                hover:border-blue-400 hover:bg-blue-50/80 transition-all min-h-[40px]
                shadow-3d-button active:translate-y-0.5 bg-white"
            >
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              Police Portal
            </button>
          </nav>
        </div>
      </header>

      {/* ── HERO SECTION WITH 3D SHIELD HOLOGRAM ── */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-20 w-full flex flex-col items-center">

        {/* Top platform capsule */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-cyan-300/60 text-slate-700 text-xs font-semibold mb-6 shadow-3d-card hover:border-cyan-400 transition-all">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Real-time Evidence Processing for Official Record Transcription</span>
        </div>

        {/* 3D Split Hero Container */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mt-2 mb-12">

          {/* Left Column: Typography & CTAs */}
          <div className="lg:col-span-7 flex flex-col text-left space-y-6">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
              Report Crimes Instantly{" "}
              <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-500 bg-clip-text text-transparent drop-shadow-sm">
                In Your Mother Tongue.
              </span>
            </h1>

            <p className="text-slate-600 text-base sm:text-lg max-w-2xl leading-relaxed">
              Experience India’s first voice-driven, AI-orchestrated public safety portal. Speak naturally in
              any regional dialect. REPORT auto-transcribes, classifies under{" "}
              <strong className="text-slate-900 font-bold underline decoration-blue-500/40">BNS 2023</strong>,
              and generates judicial-grade legal records with real-time station jurisdiction.
            </p>

            {/* Primary Action Buttons with 3D Depth */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <button
                id="cta-file-complaint"
                onClick={() => navigate("/record-statement")}
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-3
                  px-8 py-4 rounded-2xl font-bold text-base text-white transition-all
                  bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 hover:from-blue-800 hover:to-indigo-800
                  shadow-3d-button-primary hover:shadow-3d-glow-blue active:translate-y-0.5 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shadow-inner">
                  <Mic className="w-4 h-4 text-white" />
                </div>
                <span>File New FIR Statement</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                id="cta-police-login"
                onClick={() => navigate("/police-login")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5
                  px-6 py-4 rounded-2xl font-bold text-sm text-slate-800
                  bg-white/90 backdrop-blur-md border border-slate-200/90
                  shadow-3d-button hover:bg-slate-50 hover:border-slate-300
                  active:translate-y-0.5 transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4 text-blue-600" />
                <span>Station Duty Terminal</span>
              </button>
            </div>

            {/* Trust Badges Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4">
              {TRUST_BADGES.map(({ label, icon: Icon, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200/80 text-slate-600 text-xs font-semibold shadow-sm"
                >
                  <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
                  <span className="truncate">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Interactive 3D WebGL Hologram */}
          <div className="lg:col-span-5 relative flex items-center justify-center min-h-[380px] sm:min-h-[460px]">
            {/* Ambient Backlight for 3D Model */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 via-cyan-400/15 to-transparent rounded-3xl blur-2xl" />

            {/* Glassmorphic 3D Stage Container */}
            <div className="relative w-full h-[420px] rounded-3xl bg-gradient-to-b from-white/40 via-white/10 to-transparent border border-white/60 shadow-3d-card p-2 flex items-center justify-center overflow-hidden">
              {/* Interactive Three.js Shield Hologram */}
              <ThreeShieldHologram className="w-full h-full" />

              {/* Floating 3D HUD Tags */}
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950/70 backdrop-blur-md border border-cyan-400/30 text-[11px] font-mono font-bold text-cyan-300 shadow-md pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>3D NEURAL FIR SYSTEM</span>
              </div>

              <div className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/80 backdrop-blur-md border border-slate-200 text-[11px] font-bold text-slate-700 shadow-sm pointer-events-none">
                <Shield className="w-3 h-3 text-blue-600" />
                <span>Interactive 3D Engine</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── 3D EMERGENCY SOS LIVE DISPATCH CARD ── */}
        <div className="w-full max-w-4xl my-8">
          <Card3D
            maxTilt={6}
            glowColor="rgba(244, 63, 94, 0.25)"
            className="rounded-3xl"
          >
            <div className="relative p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-rose-950/90 via-slate-900 to-rose-950 border border-rose-500/40 shadow-3d-glow-rose overflow-hidden text-white">
              {/* Pulsing Radar Radial Background */}
              <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full border border-rose-500/20 animate-ping pointer-events-none" />
              <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-rose-600 flex items-center justify-center shrink-0 shadow-lg shadow-rose-600/50 border border-rose-400">
                    <AlertOctagon className="w-7 h-7 text-white animate-pulse" />
                  </div>
                  <div className="text-left space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-extrabold text-lg sm:text-xl text-white">Immediate Danger or Threat?</h2>
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-rose-300 bg-rose-900/60 border border-rose-500/50 px-2.5 py-0.5 rounded-full">
                        <Radio className="w-3 h-3 text-rose-400 animate-pulse" />
                        Live Nodal Dispatch
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-rose-200/80 max-w-xl leading-relaxed">
                      Transmits live GPS telemetry, nearest police station routing, and emergency audio distress directly to state nodal dispatch centers.
                    </p>
                  </div>
                </div>

                <button
                  id="sos-trigger-landing"
                  onClick={handleSOSClick}
                  className="w-full sm:w-auto flex items-center justify-center gap-2.5
                    px-7 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white
                    font-black text-sm uppercase tracking-wider shrink-0 transition-all
                    shadow-3d-button-danger hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <span>Trigger SOS</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card3D>
        </div>

        {/* ── 3D FEATURE PILLARS MATRIX ── */}
        <div className="mt-8 mb-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
          {FEATURE_PILLARS.map(({ icon: Icon, bg, glow, title, desc }) => (
            <Card3D
              key={title}
              maxTilt={8}
              glowColor={glow}
              className="h-full rounded-2xl"
            >
              <div className="h-full p-6 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-3d-card hover:border-blue-300 transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className={`w-11 h-11 rounded-2xl ${bg} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900">{title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center text-[11px] font-semibold text-blue-600 gap-1">
                  <span>State-certified standard</span>
                  <span>→</span>
                </div>
              </div>
            </Card3D>
          ))}
        </div>

        {/* ── INTERACTIVE 3D MULTILINGUAL MATRIX ── */}
        <div className="w-full max-w-4xl pt-8 pb-12 border-t border-slate-200/80 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-6">
            <Globe2 className="w-4 h-4 text-blue-600" />
            <span>Voice & Text Supported Across 40+ Official Dialects</span>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5">
            {HIGHLIGHT_LANGUAGES.map((l) => (
              <div
                key={l.english}
                className="group inline-flex items-center gap-2 px-4 py-2 rounded-2xl
                  bg-white/90 backdrop-blur-md border border-slate-200 text-xs font-semibold
                  shadow-3d-card hover:shadow-3d-card-hover hover:border-blue-400 hover:-translate-y-1
                  transition-all cursor-default select-none"
              >
                <span className="font-bold text-blue-700 text-sm group-hover:text-cyan-600 transition-colors">
                  {l.native}
                </span>
                <span className="text-slate-400 text-[11px]">({l.english})</span>
              </div>
            ))}
            <div className="inline-flex items-center px-4 py-2 rounded-2xl bg-blue-50/80 border border-blue-200/80 text-blue-700 text-xs font-bold shadow-sm">
              + 30 more regional dialects
            </div>
          </div>
        </div>

      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-white/90 backdrop-blur-xl border-t border-slate-200 py-6 ambient-lighting">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p className="font-semibold text-slate-600">
            REPORT — Real-time Evidence Processing for Official Record Transcription
          </p>
          <div className="flex items-center gap-3 font-bold">
            <span className="text-blue-600">BNS 2023 Compliant</span>
            <span className="text-slate-300">·</span>
            <span className="text-cyan-600">Offline-Capable</span>
            <span className="text-slate-300">·</span>
            <span className="text-emerald-600">Government of Tamil Nadu</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
