import { useNavigate } from "react-router-dom";
import { Shield, Users, ArrowRight, CheckCircle, Lock } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  // Dispatch a custom event that App.jsx listens to, to open the SOS panel
  function handleSOSClick() {
    window.dispatchEvent(new CustomEvent("open-sos-panel"));
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #312e81 100%)" }}
    >
      {/* Logo / Title */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-6 text-white backdrop-blur-sm">
          <Shield className="h-4 w-4 text-blue-300" />
          Tamil Nadu Police · REPORT System
        </div>
        <h1 className="text-6xl font-black text-white tracking-tight mb-2">REPORT</h1>
        <p className="text-blue-200 text-lg font-semibold mb-1">
          Real-time Evidence Processing for Official Record Transcription
        </p>
        <p className="text-blue-300 text-sm max-w-md mx-auto">
          AI-powered multilingual FIR filing system — file complaints in your own language
        </p>
      </div>

      {/* ── SOS button — sits ABOVE the two portal cards, no auto-open ── */}
      <div className="w-full max-w-2xl mb-6">
        <button
          onClick={handleSOSClick}
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-3.5 px-6 font-bold text-white text-sm tracking-widest uppercase transition-all duration-200 hover:scale-[1.02] active:scale-95"
          style={{
            background: "linear-gradient(135deg, #7f1d1d, #991b1b)",
            border: "1.5px solid rgba(220,38,38,0.55)",
            boxShadow: "0 4px 24px rgba(220,38,38,0.3)",
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#fca5a5",
              animation: "sos-blink 0.9s ease-in-out infinite alternate",
              flexShrink: 0,
            }}
          />
          Emergency SOS — Send Live Location to Police
        </button>

        {/* Tiny blink keyframe injected inline so it works without a CSS file */}
        <style>{`
          @keyframes sos-blink {
            from { opacity: 0.4; box-shadow: 0 0 4px #f87171; }
            to   { opacity: 1;   box-shadow: 0 0 10px #f87171; }
          }
        `}</style>

        <p className="text-center text-red-300/70 text-xs mt-2">
          Tap only in genuine emergencies · SMS sent to nearest Tamil Nadu Police station
        </p>
      </div>

      {/* Two access cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl">
        {/* Citizen Card — ↓ ONLY CHANGE: /home → /citizen-login */}
        <button
          onClick={() => navigate("/citizen-login")}
          className="group bg-white rounded-2xl p-8 text-left hover:shadow-2xl hover:scale-105 transition-all duration-200 shadow-lg"
        >
          <div className="bg-blue-100 rounded-xl p-3 w-fit mb-4">
            <Users className="h-7 w-7 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Citizen Portal</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-5">
            File an FIR complaint in your own language using voice recording. Available in 40+ languages.
          </p>
          <div className="space-y-1.5 mb-6">
            {["Voice-based FIR filing", "AI auto-fills all details", "Multilingual support"].map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-gray-600">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm group-hover:gap-3 transition-all">
            File a Complaint <ArrowRight className="h-4 w-4" />
          </div>
        </button>

        {/* Police Card — unchanged */}
        <button
          onClick={() => navigate("/police-login")}
          className="group bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl p-8 text-left hover:bg-white/20 hover:scale-105 transition-all duration-200 shadow-lg"
        >
          <div className="bg-blue-900/50 rounded-xl p-3 w-fit mb-4 border border-white/10">
            <Lock className="h-7 w-7 text-blue-200" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Police Portal</h2>
          <p className="text-blue-200 text-sm leading-relaxed mb-5">
            Station officers can view and manage FIR complaints filed near their jurisdiction.
          </p>
          <div className="space-y-1.5 mb-6">
            {["View nearby complaints", "Filter by crime type", "Update case status"].map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-blue-200">
                <CheckCircle className="h-3.5 w-3.5 text-blue-300 shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-blue-200 font-semibold text-sm group-hover:gap-3 transition-all">
            Police Login <ArrowRight className="h-4 w-4" />
          </div>
        </button>
      </div>

      {/* Team footer */}
      <p className="text-blue-400 text-xs mt-10 text-center">
        Team WhiteCoders · Adhiparashakthi College of Engineering · B.Tech AI&DS II Year
      </p>
    </div>
  );
}
