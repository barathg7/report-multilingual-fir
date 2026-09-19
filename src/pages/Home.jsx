import { useNavigate } from "react-router-dom";
import {
  Shield,
  Mic,
  FileText,
  MapPin,
  User,
  Wifi,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Lock,
  Radio,
  Cpu,
  Globe2,
} from "lucide-react";
import Card3D from "@/components/ui/Card3D";
import ThreeShieldHologram from "@/components/ui/ThreeShieldHologram";
import QuickShieldWidget from "@/components/kavalan/QuickShieldWidget";

const features = [
  {
    icon: Mic,
    title: "Multilingual Voice AI",
    desc: "Speak naturally in 40+ regional dialects. Automatic transcription & phonetic transliteration.",
    glow: "rgba(59, 130, 246, 0.2)",
  },
  {
    icon: Cpu,
    title: "BNS 2023 Neural Mapping",
    desc: "Classifies offenses and recommends legal sections under Bharatiya Nyaya Sanhita.",
    glow: "rgba(99, 102, 241, 0.2)",
  },
  {
    icon: MapPin,
    title: "Station GPS Jurisdiction",
    desc: "Geospatial coordinate boundary mapping across 3,500+ police stations nationwide.",
    glow: "rgba(16, 185, 129, 0.2)",
  },
  {
    icon: FileText,
    title: "Certified State DOCX",
    desc: "Produces judicial-grade bilingual FIR documentation ready for station filing and court submission.",
    glow: "rgba(245, 158, 11, 0.2)",
  },
  {
    icon: User,
    title: "Biometric & ID Security",
    desc: "Two-factor OTP verified citizen credentials and cryptographic digital signature seals.",
    glow: "rgba(6, 182, 212, 0.2)",
  },
  {
    icon: Wifi,
    title: "Offline Storage & Sync",
    desc: "Full offline complaint drafting with automatic background sync when connectivity resumes.",
    glow: "rgba(239, 68, 68, 0.2)",
  },
];

const stats = [
  { value: "98.4%", label: "Voice Recognition Accuracy", color: "text-blue-600" },
  { value: "40+",   label: "Languages & Regional Dialects", color: "text-cyan-600" },
  { value: "< 3 min", label: "Average FIR Draft Completion", color: "text-indigo-600" },
  { value: "3,500+", label: "Integrated Police Stations", color: "text-emerald-600" },
];

export default function Home() {
  const navigate = useNavigate();

  const citizen = (() => {
    try {
      const raw = localStorage.getItem("citizen_user") || sessionStorage.getItem("citizen_user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-blue-600 selection:text-white relative overflow-x-hidden civic-mesh-bg">

      {/* Background ambient lighting */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full bg-cyan-400/10 blur-[130px]" />
        <div className="absolute inset-0 hologram-grid opacity-50" />
      </div>

      {/* Top Header Bar */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-30 shadow-sm ambient-lighting">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center border border-cyan-400/40 shadow-sm">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <span className="font-black text-slate-900 text-base tracking-tight">REPORT</span>
              <span className="hidden sm:inline text-[10px] font-bold text-slate-400 ml-2 uppercase">
                Public Safety Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {citizen ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800">
                <User className="h-3.5 w-3.5 text-blue-600" />
                <span>{citizen.name}</span>
              </div>
            ) : (
              <button
                onClick={() => navigate("/citizen-login")}
                className="text-xs font-bold text-slate-700 hover:text-blue-700 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Sign In
              </button>
            )}
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 text-white font-bold text-xs shadow-3d-button-primary hover:shadow-3d-glow-blue transition-all cursor-pointer"
            >
              <span>Dashboard</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-20 w-full flex flex-col items-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-cyan-300/60 text-slate-700 text-xs font-semibold mb-6 shadow-3d-card">
          <Shield className="h-4 w-4 text-blue-600" />
          <span>Tamil Nadu Police · AI Multilingual Reporting System</span>
        </div>

        {/* 3D Split Hero */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mt-2 mb-12">
          <div className="lg:col-span-7 flex flex-col text-left space-y-5">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
              Citizen Digital Evidence &amp;{" "}
              <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                FIR Processing Portal
              </span>
            </h1>

            <p className="text-slate-600 text-base sm:text-lg max-w-2xl leading-relaxed">
              Empowering victims and citizens to record accurate, legally sound police complaints in any
              language. Powered by real-time speech intelligence, automatic BNS 2023 classification, and
              direct station dispatch.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <button
                onClick={() => navigate("/dashboard")}
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-3
                  px-8 py-4 rounded-2xl font-bold text-base text-white transition-all
                  bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 hover:from-blue-800 hover:to-indigo-800
                  shadow-3d-button-primary hover:shadow-3d-glow-blue active:translate-y-0.5 cursor-pointer"
              >
                <span>Access Citizen Dashboard</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={() => navigate("/record-statement")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5
                  px-6 py-4 rounded-2xl font-bold text-sm text-slate-800
                  bg-white/90 backdrop-blur-md border border-slate-200/90
                  shadow-3d-button hover:bg-slate-50 hover:border-slate-300
                  active:translate-y-0.5 transition-all cursor-pointer"
              >
                <Mic className="h-4 w-4 text-blue-600" />
                <span>File New Complaint</span>
              </button>
            </div>
          </div>

          {/* 3D Shield Display */}
          <div className="lg:col-span-5 relative flex items-center justify-center min-h-[360px]">
            <div className="relative w-full h-[400px] rounded-3xl bg-gradient-to-b from-white/40 via-white/10 to-transparent border border-white/60 shadow-3d-card p-2 flex items-center justify-center overflow-hidden">
              <ThreeShieldHologram className="w-full h-full" />
            </div>
          </div>
        </div>

        {/* ── REPORT QUICKSHIELD CONSOLE ── */}
        <div className="w-full mb-10">
          <QuickShieldWidget
            onTriggerEmergency={() => {
              window.dispatchEvent(new CustomEvent("open-sos-panel"));
            }}
          />
        </div>

        {/* 3D Stats Ribbon */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-4 mb-14">
          {stats.map(({ value, label, color }) => (
            <Card3D key={label} maxTilt={6} className="rounded-2xl">
              <div className="p-5 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-3d-card text-center h-full flex flex-col justify-center">
                <p className={`text-3xl sm:text-4xl font-black ${color} tracking-tight`}>{value}</p>
                <p className="text-slate-500 text-xs font-semibold mt-1">{label}</p>
              </div>
            </Card3D>
          ))}
        </div>

        {/* 3D Features Grid */}
        <div className="w-full space-y-6">
          <div className="text-center space-y-1">
            <p className="text-xs font-extrabold uppercase tracking-widest text-blue-600">
              System Architecture &amp; Core Capabilities
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Engineered for Fairness, Speed &amp; Accuracy
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
            {features.map(({ icon: Icon, title, desc, glow }) => (
              <Card3D key={title} maxTilt={8} glowColor={glow} className="rounded-2xl h-full">
                <div className="h-full p-6 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-3d-card hover:border-blue-300 transition-all flex flex-col justify-between space-y-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-700 flex items-center justify-center shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base mb-1">{title}</h3>
                    <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                  </div>
                </div>
              </Card3D>
            ))}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white/90 backdrop-blur-xl border-t border-slate-200 py-6 ambient-lighting">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p className="font-semibold text-slate-600">
            REPORT — Real-time Evidence Processing for Official Record Transcription
          </p>
          <div className="flex items-center gap-3 font-bold">
            <span className="text-blue-600">BNS 2023 Compliant</span>
            <span className="text-slate-300">·</span>
            <span className="text-cyan-600">Offline Resilience</span>
            <span className="text-slate-300">·</span>
            <span className="text-emerald-600">Tamil Nadu Police</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
