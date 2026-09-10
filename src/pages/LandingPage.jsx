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
} from "lucide-react";

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
  { label: "BNS 2023 Compliant",      icon: FileText    },
  { label: "End-to-End Encrypted",    icon: Fingerprint  },
  { label: "3,500+ Jurisdictions",    icon: Building2   },
  { label: "40+ Languages Supported", icon: Globe2      },
];

const FEATURE_PILLARS = [
  {
    icon: Mic,
    bg:   "bg-civic-blue-50",
    text: "text-civic-blue-700",
    title: "Voice-First Reporting",
    desc:  "Speak naturally in your dialect. Speech recognition captures and transcribes your spoken statement in real-time.",
  },
  {
    icon: UserCheck,
    bg:   "bg-indigo-50",
    text: "text-indigo-700",
    title: "Human Verification",
    desc:  "AI suggests incident fields and relevant BNS 2023 sections. You verify and confirm every entry before submission.",
  },
  {
    icon: Building2,
    bg:   "bg-emerald-50",
    text: "text-emerald-700",
    title: "Station Jurisdiction",
    desc:  "GPS mapping automatically determines the correct jurisdiction across 3,500+ police stations nationwide.",
  },
  {
    icon: FileText,
    bg:   "bg-amber-50",
    text: "text-amber-700",
    title: "Official State DOCX",
    desc:  "Downloads certified bilingual FIR documents in official state-specific templates ready for court submission.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  const handleSOSClick = () => {
    window.dispatchEvent(new CustomEvent("open-sos-panel"));
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-civic-blue-600 selection:text-white relative overflow-x-hidden">

      {/* ── AMBIENT MESH BACKGROUND ── */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-slate-50" />
        {/* Top-left civic-blue ambient glow */}
        <div className="absolute -top-48 -left-48 w-[640px] h-[640px] rounded-full bg-civic-blue-500/5 blur-3xl" />
        {/* Bottom-right navy ambient glow */}
        <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-civic-navy-800/4 blur-3xl" />
        {/* Subtle noise texture */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.018]" xmlns="http://www.w3.org/2000/svg">
          <filter id="lp-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#lp-noise)" />
        </svg>
      </div>

      {/* ── STICKY GLASSMORPHIC NAV ── */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

          {/* Brand lockup */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-civic-navy-900 flex items-center justify-center
              shadow-[0_4px_12px_-2px_rgba(15,23,42,0.35),0_1px_0_0_rgba(255,255,255,0.08)_inset]">
              <Shield className="w-[18px] h-[18px] text-civic-blue-400" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-[15px] text-civic-navy-900 tracking-tight">REPORT</span>
              <span className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase">Public Service Platform</span>
            </div>
          </div>

          {/* Nav actions */}
          <nav className="flex items-center gap-1">
            <button
              id="nav-citizen-login"
              onClick={() => navigate("/citizen-login")}
              className="text-xs font-semibold text-slate-600 hover:text-civic-blue-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors min-h-[40px]"
            >
              Citizen Login
            </button>
            <button
              id="nav-track-complaint"
              onClick={() => navigate("/fir-history")}
              className="hidden sm:inline-flex text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors min-h-[40px]"
            >
              Track Complaint
            </button>
            <button
              id="nav-police-portal"
              onClick={() => navigate("/police-login")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700
                hover:text-civic-blue-700 px-3 py-2 rounded-lg border border-slate-200
                hover:border-civic-blue-300 hover:bg-civic-blue-50/60 transition-all min-h-[40px]
                shadow-[0_1px_3px_0_rgba(15,23,42,0.06)]"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Police Portal
            </button>
          </nav>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 pt-14 pb-20 w-full flex flex-col items-center text-center">

        {/* Platform capsule */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-semibold mb-8
          shadow-[0_1px_4px_0_rgba(15,23,42,0.06)]">
          <span className="w-1.5 h-1.5 rounded-full bg-civic-blue-500 animate-pulse" />
          <Globe2 className="w-3.5 h-3.5 text-civic-blue-600" />
          <span>Multilingual Digital Police Reporting Platform</span>
        </div>

        {/* H1 — one per page for SEO */}
        <h1 className="text-3xl sm:text-[2.75rem] lg:text-5xl font-black text-civic-navy-900 tracking-tight max-w-3xl leading-[1.13] mb-5">
          Explain what happened{" "}
          <span className="text-civic-blue-700">in your own language.</span>
          <br className="hidden sm:block" />
          <span className="text-civic-navy-600 font-bold text-2xl sm:text-3xl lg:text-[2.25rem]">REPORT will help you structure it.</span>
        </h1>

        {/* Sub-headline */}
        <p className="text-slate-500 text-sm sm:text-base max-w-2xl leading-relaxed mb-10">
          A voice-first, AI-assisted platform that translates and structures citizen statements into official FIR records
          compliant with{" "}
          <strong className="text-slate-700 font-semibold">Bharatiya Nyaya Sanhita (BNS 2023)</strong>.
          Every detail is reviewed and confirmed by you.
        </p>

        {/* ── PRIMARY CTA PAIR ── */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mb-10">
          <button
            id="cta-file-complaint"
            onClick={() => navigate("/record-statement")}
            className="group w-full sm:w-auto inline-flex items-center justify-center gap-2.5
              px-8 py-4 rounded-2xl font-bold text-base text-white transition-all
              bg-civic-blue-700 hover:bg-civic-blue-800
              shadow-[0_4px_20px_-4px_rgba(29,78,216,0.42),0_1px_0_0_rgba(255,255,255,0.1)_inset]
              hover:shadow-[0_6px_28px_-4px_rgba(29,78,216,0.52)]
              active:translate-y-0.5 active:shadow-[0_2px_8px_-2px_rgba(29,78,216,0.32)]"
          >
            <Mic className="w-5 h-5 text-civic-blue-200" />
            <span>File a Complaint</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <button
            id="cta-police-login"
            onClick={() => navigate("/police-login")}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2
              px-6 py-4 rounded-2xl font-semibold text-sm text-slate-700
              bg-white border border-slate-200
              shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08),0_1px_0_0_rgba(255,255,255,0.9)_inset]
              hover:bg-slate-50 hover:border-slate-300
              hover:shadow-[0_4px_14px_-4px_rgba(15,23,42,0.12)]
              active:translate-y-0.5 transition-all"
          >
            <Lock className="w-4 h-4 text-slate-400" />
            <span>Official Police Login</span>
          </button>
        </div>

        {/* ── TRUST BADGE STRIP ── */}
        <div className="flex flex-wrap justify-center gap-2 mb-14">
          {TRUST_BADGES.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                bg-white border border-slate-200 text-slate-500 text-xs font-medium
                shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]"
            >
              <Icon className="w-3.5 h-3.5 text-civic-blue-500" />
              {label}
            </div>
          ))}
        </div>

        {/* ── FLOATING SOS DOSSIER CARD ── */}
        <div className="w-full max-w-2xl mb-16">
          <div className="relative">
            {/* Ambient glow under card */}
            <div className="absolute inset-x-12 -bottom-4 h-10 bg-rose-500/12 blur-xl rounded-full" />
            <div className="relative p-4 sm:p-5 rounded-2xl bg-white border border-rose-200/70 overflow-hidden
              shadow-[0_4px_24px_-4px_rgba(220,38,38,0.14),0_1px_0_0_rgba(255,255,255,0.9)_inset]">
              {/* Rose accent bar */}
              <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-rose-600 via-rose-500 to-rose-700 rounded-t-2xl" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0
                    shadow-[0_4px_12px_-2px_rgba(220,38,38,0.4)]">
                    <AlertOctagon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <p className="font-bold text-sm text-rose-950">Immediate Danger / Emergency?</p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider
                        text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                        <Radio className="w-2.5 h-2.5" />
                        Live Dispatch
                      </span>
                    </div>
                    <p className="text-xs text-rose-700/80">
                      Broadcasts live GPS coordinates directly to the nearest police station.
                    </p>
                  </div>
                </div>
                <button
                  id="sos-trigger-landing"
                  onClick={handleSOSClick}
                  className="w-full sm:w-auto flex items-center justify-center gap-2
                    px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white
                    font-bold text-xs uppercase tracking-wider shrink-0 transition-all
                    shadow-[0_4px_12px_-2px_rgba(185,28,28,0.4)]
                    active:translate-y-0.5"
                >
                  Trigger SOS
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── LANGUAGES SECTION ── */}
        <div className="w-full max-w-3xl pt-10 border-t border-slate-200">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">
            Voice &amp; Text Supported in 40+ Languages
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {HIGHLIGHT_LANGUAGES.map((l) => (
              <span
                key={l.english}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                  bg-white border border-slate-200 text-xs font-medium cursor-default
                  shadow-[0_1px_4px_0_rgba(15,23,42,0.06)]
                  hover:shadow-[0_2px_8px_0_rgba(15,23,42,0.10)]
                  hover:border-civic-blue-200 hover:-translate-y-0.5 transition-all"
              >
                <span className="font-bold text-civic-blue-700">{l.native}</span>
                <span className="text-slate-400 text-[10px]">· {l.english}</span>
              </span>
            ))}
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold border border-slate-200">
              + 30 more
            </span>
          </div>
        </div>

        {/* ── FEATURE PILLARS ── */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full text-left">
          {FEATURE_PILLARS.map(({ icon: Icon, bg, text, title, desc }) => (
            <div
              key={title}
              className="group p-5 rounded-2xl bg-white border border-slate-200 space-y-3 transition-all
                shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08),0_1px_0_0_rgba(255,255,255,0.9)_inset]
                hover:shadow-[0_6px_20px_-4px_rgba(15,23,42,0.12),0_1px_0_0_rgba(255,255,255,0.9)_inset]
                hover:-translate-y-0.5"
            >
              <div className={`w-9 h-9 rounded-xl ${bg} ${text} flex items-center justify-center transition-transform group-hover:scale-110`}>
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-civic-navy-900 mb-1">{title}</h2>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p className="font-medium">REPORT — Real-time Evidence Processing for Official Record Transcription</p>
          <div className="flex items-center gap-3 font-semibold">
            <span className="text-civic-blue-600">BNS 2023 Compliant</span>
            <span className="text-slate-200">·</span>
            <span>Offline-Ready</span>
            <span className="text-slate-200">·</span>
            <span>Public Service AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
