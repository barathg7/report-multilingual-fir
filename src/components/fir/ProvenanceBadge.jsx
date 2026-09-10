/**
 * ProvenanceBadge — Stage 3/4 component
 * Renders a small pill badge for data provenance labeling.
 *
 * source:
 *   "USER-PROVIDED"     — citizen typed/spoke this directly
 *   "USER-EDITED"       — AI extracted, then citizen corrected it
 *   "AI-EXTRACTED"      — extracted from voice/sign by AI (unverified)
 *   "AI-SUGGESTED"      — AI suggested (e.g. legal sections)
 *   "SYSTEM-GENERATED"  — computed by the platform (GPS, IDs, routing)
 *   "POLICE-VERIFIED"   — confirmed by police officer
 *   "PENDING"           — awaiting police action
 *
 * NOTE: All variants use both color AND a human-readable label
 * for WCAG accessibility — never rely on color alone.
 */
const CONFIG = {
  "USER-PROVIDED":    { bg: "bg-civic-blue-50",  text: "text-civic-blue-700",  border: "border-civic-blue-200",  dot: "bg-civic-blue-500",  label: "You provided"    },
  "USER-EDITED":      { bg: "bg-amber-50",        text: "text-amber-700",       border: "border-amber-200",       dot: "bg-amber-500",        label: "You edited"      },
  "AI-EXTRACTED":     { bg: "bg-purple-50",       text: "text-purple-700",      border: "border-purple-200",      dot: "bg-purple-500",       label: "AI extracted"    },
  "AI-SUGGESTED":     { bg: "bg-purple-50",       text: "text-purple-700",      border: "border-purple-200",      dot: "bg-purple-500",       label: "AI suggested"    },
  "SYSTEM-GENERATED": { bg: "bg-slate-100",        text: "text-slate-600",       border: "border-slate-200",       dot: "bg-slate-400",        label: "System"          },
  "POLICE-VERIFIED":  { bg: "bg-emerald-50",      text: "text-emerald-700",     border: "border-emerald-200",     dot: "bg-emerald-500",      label: "Police verified" },
  "PENDING":          { bg: "bg-slate-50",         text: "text-slate-500",       border: "border-slate-200",       dot: "bg-slate-300",        label: "Pending"         },
};

/**
 * @param {string} source — one of the keys above
 * @param {boolean} [compact] — if true, shows dot+tiny badge (no label text) for inline field use
 */
export default function ProvenanceBadge({ source, compact = false }) {
  const c = CONFIG[source] || CONFIG["SYSTEM-GENERATED"];
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-full border shrink-0 ${c.bg} ${c.text} ${c.border} ${
        compact ? "text-[8px] px-1.5 py-0.5" : "text-[9px] px-2 py-0.5"
      }`}
      title={c.label}
      aria-label={c.label}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} aria-hidden="true" />
      {!compact && c.label}
    </span>
  );
}
