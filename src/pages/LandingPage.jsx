import { useNavigate } from "react-router-dom";
import {
  Shield,
  FileText,
  Lock,
  ArrowRight,
  CheckCircle2,
  Mic,
  Globe2,
  AlertOctagon,
  Clock,
  Building2,
  UserCheck,
} from "lucide-react";

const HIGHLIGHT_LANGUAGES = [
  { native: "தமிழ்", english: "Tamil" },
  { native: "हिन्दी", english: "Hindi" },
  { native: "English", english: "English" },
  { native: "తెలుగు", english: "Telugu" },
  { native: "ಕನ್ನಡ", english: "Kannada" },
  { native: "മലയാളം", english: "Malayalam" },
  { native: "मराठी", english: "Marathi" },
  { native: "বাংলা", english: "Bengali" },
  { native: "ગુજરાતી", english: "Gujarati" },
  { native: "ਪੰਜਾਬੀ", english: "Punjabi" },
];

export default function LandingPage() {
  const navigate = useNavigate();

  const handleSOSClick = () => {
    window.dispatchEvent(new CustomEvent("open-sos-panel"));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* ── TOP NAV BAR ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-sm">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-slate-900 tracking-tight">REPORT</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                v2.0 Public Service Prototype
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate("/fir-history")}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Track Complaint
            </button>
            <button
              onClick={() => navigate("/police-login")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Police Portal
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 w-full flex flex-col items-center text-center">
        
        {/* Positioning Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold mb-6">
          <Globe2 className="w-4 h-4 text-blue-600" />
          <span>Multilingual Digital Police Reporting Platform</span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight max-w-3xl leading-[1.15]">
          Explain what happened in your own language. <br className="hidden sm:inline" />
          <span className="text-blue-700">REPORT will help you structure it.</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-slate-600 text-sm sm:text-base max-w-2xl leading-relaxed">
          A voice-first, AI-assisted platform that translates and structures citizen statements into official FIR records compliant with Bharatiya Nyaya Sanhita (BNS 2023). Every detail is reviewed and confirmed by you.
        </p>

        {/* ── PRIMARY ACTIONS ── */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
          <button
            onClick={() => navigate("/record-statement")}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-xl bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold text-base shadow-lg shadow-blue-700/20 transition-all"
          >
            <Mic className="w-5 h-5 text-blue-200" />
            <span>File a Complaint</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate("/police-login")}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-semibold text-sm transition-all"
          >
            <Lock className="w-4 h-4 text-slate-500" />
            <span>Official Police Login</span>
          </button>
        </div>

        {/* ── EMERGENCY SOS CARD ── */}
        <div className="mt-8 w-full max-w-xl">
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-rose-950">Immediate Danger / Emergency?</p>
                <p className="text-xs text-rose-700">Broadcast your live GPS coordinates directly to nearest stations.</p>
              </div>
            </div>
            <button
              onClick={handleSOSClick}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs uppercase tracking-wider shrink-0 transition-colors shadow-sm"
            >
              Trigger SOS
            </button>
          </div>
        </div>

        {/* ── SUPPORTED LANGUAGES PILLS ── */}
        <div className="mt-12 w-full max-w-3xl pt-8 border-t border-slate-200">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
            Voice & Text Supported in 40+ Languages
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {HIGHLIGHT_LANGUAGES.map((l) => (
              <span
                key={l.english}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-medium shadow-2xs"
              >
                <span className="font-semibold text-blue-700">{l.native}</span>
                <span className="text-slate-400">· {l.english}</span>
              </span>
            ))}
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold">
              + 30 more
            </span>
          </div>
        </div>

        {/* ── CORE SYSTEM PRINCIPLES (FOUR PILLARS) ── */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full text-left">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-sm text-slate-900">Voice-First Reporting</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Citizens can speak naturally in their dialect. Speech recognition captures and transcribes spoken evidence.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-sm text-slate-900">Human Verification</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              AI suggests incident fields and relevant BNS 2023 sections, but the complainant verifies and confirms every entry.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-sm text-slate-900">Station Jurisdiction</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              GPS mapping automatically determines jurisdiction across 3,500+ police stations nationwide.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-sm text-slate-900">Official State DOCX</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Downloads certified bilingual FIR documents in official state-specific templates ready for court submission.
            </p>
          </div>
        </div>

      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>REPORT — Real-time Evidence Processing for Official Record Transcription</p>
          <div className="flex items-center gap-4">
            <span>BNS 2023 Compliant</span>
            <span>·</span>
            <span>Offline-Ready</span>
            <span>·</span>
            <span>Public Service AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
