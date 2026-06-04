import { useNavigate } from "react-router-dom";
import { Shield, Mic, FileText, MapPin, User, Wifi, ArrowRight, CheckCircle } from "lucide-react";

const features = [
  { icon: Mic,      title: "Multilingual Voice",      desc: "22+ languages via OpenAI Whisper STT" },
  { icon: Shield,   title: "AI IPC Classification",   desc: "GPT-4o-mini extracts crime details & sections" },
  { icon: MapPin,   title: "GPS Crime Mapping",       desc: "OpenStreetMap + Nominatim geocoding" },
  { icon: FileText, title: "Bilingual FIR PDF",       desc: "English + Tamil official document" },
  { icon: User,     title: "AI Suspect Sketch",       desc: "DALL-E 3 composite portrait generation" },
  { icon: Wifi,     title: "Offline Support",         desc: "Local sync, works without internet" },
];

const stats = [
  { value: "92%",   label: "Transcription Accuracy" },
  { value: "22+",   label: "Languages Supported" },
  { value: "5 min", label: "FIR Filing Time" },
  { value: "7",     label: "Guided Steps" },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #312e81 100%)" }}>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 text-white">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-8 backdrop-blur-sm">
          <Shield className="h-4 w-4 text-blue-300" />
          <span>Tamil Nadu Police · National Level Hackathon Project</span>
        </div>

        {/* Title */}
        <h1 className="text-6xl font-black tracking-tight mb-3">REPORT</h1>
        <p className="text-blue-200 text-xl font-semibold mb-2">
          Real-time Evidence Processing for Official Record Transcription
        </p>
        <p className="text-blue-300 text-base max-w-2xl leading-relaxed mb-4">
          An AI-powered multilingual FIR filing system that lets any victim — tourist or citizen —
          report crimes in their own language, anywhere in India.
        </p>

        {/* Team badge */}
        <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm text-blue-200 mb-10">
          <CheckCircle className="h-4 w-4 text-green-400" />
          Team WhiteCoders · Adhiparashakthi College of Engineering, Kalavai · B.Tech AI&DS II Year
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate("/dashboard")}
          className="group inline-flex items-center gap-3 bg-white text-blue-800 font-bold px-10 py-4 rounded-2xl hover:bg-blue-50 transition-all shadow-2xl hover:shadow-blue-500/20 hover:scale-105 text-lg"
        >
          Enter System
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Stats */}
      <div className="bg-white/10 backdrop-blur-sm border-y border-white/10 py-6 px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-4 gap-4 text-center text-white">
          {stats.map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-black">{value}</p>
              <p className="text-blue-300 text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-blue-400 text-xs font-semibold uppercase tracking-widest mb-6">Key Features</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white/10 backdrop-blur border border-white/10 rounded-xl p-4 hover:bg-white/15 transition-colors">
                <Icon className="h-5 w-5 text-blue-300 mb-2" />
                <p className="font-semibold text-white text-sm">{title}</p>
                <p className="text-blue-300 text-xs mt-1 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 py-4 text-center">
        <p className="text-blue-400 text-xs">
          Powered by{" "}
          {["OpenAI Whisper", "GPT-4o-mini", "DALL-E 3", "OpenStreetMap", "React + Vite"].map((t, i, a) => (
            <span key={t}><span className="text-blue-200 font-medium">{t}</span>{i < a.length - 1 && " · "}</span>
          ))}
        </p>
      </div>
    </div>
  );
}
