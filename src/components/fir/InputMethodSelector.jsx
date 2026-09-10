/**
 * InputMethodSelector — Stage 3 extracted component
 * Pure presentation. All state and handlers come from RecordStatement via props.
 * Does NOT alter any FIR data, provenance, or state logic.
 */
import { Mic, Keyboard, Hand, FlaskConical } from "lucide-react";

const MODES = [
  {
    id: "voice",
    icon: Mic,
    label: "Voice",
    sub: "Speak naturally",
    activeColor: "border-civic-blue-500 bg-civic-blue-50 text-civic-blue-800",
    iconColor: "text-civic-blue-600",
    dotColor: "bg-civic-blue-500",
  },
  {
    id: "type",
    icon: Keyboard,
    label: "Type",
    sub: "Write your statement",
    activeColor: "border-civic-blue-500 bg-civic-blue-50 text-civic-blue-800",
    iconColor: "text-civic-blue-600",
    dotColor: "bg-civic-blue-500",
  },
  {
    id: "sign",
    icon: Hand,
    label: "Sign Language",
    labelShort: "Sign",
    sub: "Experimental",
    activeColor: "border-emerald-500 bg-emerald-50 text-emerald-800",
    iconColor: "text-emerald-600",
    dotColor: "bg-emerald-500",
    experimental: true,
  },
];

export default function InputMethodSelector({ inputMode, setInputMode }) {
  return (
    <div
      role="group"
      aria-label="Choose statement input method"
      className="grid grid-cols-3 gap-2"
    >
      {MODES.map(({ id, icon: Icon, label, sub, activeColor, iconColor, dotColor, experimental }) => {
        const isActive = inputMode === id;
        return (
          <button
            key={id}
            type="button"
            id={`input-mode-${id}`}
            onClick={() => setInputMode(id)}
            aria-pressed={isActive}
            className={`
              relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl border-2 text-center
              transition-all min-h-[80px] justify-center
              focus:outline-none focus-visible:ring-2 focus-visible:ring-civic-blue-500 focus-visible:ring-offset-2
              ${isActive
                ? `${activeColor} shadow-[0_2px_8px_-2px_rgba(15,23,42,0.12)]`
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              }
            `}
          >
            {/* Active indicator dot */}
            {isActive && (
              <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
            )}

            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              isActive ? "bg-white/70" : "bg-slate-100"
            }`}>
              <Icon className={`h-4 w-4 ${isActive ? iconColor : "text-slate-400"}`} aria-hidden="true" />
            </div>

            <div>
              <p className={`text-xs font-bold leading-none ${isActive ? "" : "text-slate-600"}`}>
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{id === "sign" ? "Sign" : label}</span>
              </p>
              {experimental ? (
                <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                  <FlaskConical className="h-2 w-2" aria-hidden="true" />
                  Experimental
                </span>
              ) : (
                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{sub}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
