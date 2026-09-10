/**
 * LegalSuggestionCard — Stage 4 component
 *
 * Presents AI-suggested BNS legal sections with:
 *  - Clear "AI Legal Suggestion — Requires Police Verification" header
 *  - Per-section rows: section number · act · title · explanation · confidence
 *  - Expandable "Why was this suggested?" for each section
 *  - Remove button (edit mode only — calls onRemove passed from caller)
 *  - Disclaimer footer: not legally binding
 *
 * SAFETY CONTRACT:
 *  - NEVER renders "Confirmed", "Official section", or "Law Applied"
 *  - Does NOT invoke any BNS validation — caller passes pre-validated data
 *  - Does NOT modify any FIR state — only calls onRemove
 *  - Preserves BNS 2023 terminology — no IPC references
 *  - BNS §303 = Theft, BNS §304 = Snatching
 *
 * Props:
 *  - sections: string[]           — list of section numbers (e.g. ["303","304"])
 *  - legalSuggestions: object[]   — canonical suggestion objects (from handleVoiceComplete)
 *  - onRemove: (section) => void  — only used in edit variant; can be null in review
 *  - validation: object|null      — { isValid, summary } from validateIPCSections
 *  - variant: "edit"|"review"     — "edit" shows remove buttons; "review" is read-only
 */
import { useState } from "react";
import { BookOpen, AlertTriangle, ChevronDown, ChevronUp, Check, X } from "lucide-react";

export default function LegalSuggestionCard({
  sections = [],
  legalSuggestions = [],
  onRemove,
  validation,
  variant = "edit",
}) {
  const [expandedSection, setExpandedSection] = useState(null);
  if (sections.length === 0) return null;

  // Build a map from section number → rich object (if available from legalSuggestions)
  const richMap = {};
  legalSuggestions.forEach(s => {
    if (s?.section) richMap[String(s.section)] = s;
  });

  const isEdit = variant === "edit";

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white overflow-hidden"
      role="region"
      aria-label="AI Legal Suggestion"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-start gap-2.5 min-w-0">
          <BookOpen className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-civic-navy-900 leading-snug">
              AI Legal Suggestion
            </p>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
              Suggested from your statement. Police and legal verification required before any action.
            </p>
          </div>
        </div>
        <span
          className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full
                     bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap leading-none mt-0.5"
        >
          ⚠ Verification required
        </span>
      </div>

      {/* ── Section list ── */}
      <div className="divide-y divide-slate-100">
        {sections.map(sec => {
          const rich = richMap[sec];
          const isExpanded = expandedSection === sec;

          return (
            <div key={sec}>
              {/* Section summary row */}
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center font-mono text-xs font-bold text-civic-navy-900
                                     bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md shrink-0">
                      BNS §{sec}
                    </span>
                    {rich?.act && (
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                        {rich.act}
                      </span>
                    )}
                    {rich?.title && (
                      <span className="text-xs text-slate-700 font-medium">
                        {rich.title}
                      </span>
                    )}
                  </div>
                  {rich?.confidence != null && (
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <span>Match confidence: {Math.round(rich.confidence * 100)}%</span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="italic">Not verified by police</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Expand/collapse explanation */}
                  {rich?.explanation && (
                    <button
                      type="button"
                      onClick={() => setExpandedSection(isExpanded ? null : sec)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-civic-blue-600
                                 hover:text-civic-blue-800 transition-colors px-2 py-1.5 rounded-lg hover:bg-civic-blue-50
                                 min-h-[36px]"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? "Hide explanation" : "Why was this suggested?"}
                    >
                      {isExpanded
                        ? <><ChevronUp className="h-3 w-3" aria-hidden="true" />Less</>
                        : <><ChevronDown className="h-3 w-3" aria-hidden="true" />Why?</>
                      }
                    </button>
                  )}
                  {/* Remove — edit mode only */}
                  {isEdit && onRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(sec)}
                      className="inline-flex items-center justify-center text-slate-400 hover:text-rose-600
                                 transition-colors p-1.5 rounded-lg hover:bg-rose-50 min-h-[36px] min-w-[36px]"
                      aria-label={`Remove BNS section ${sec} from suggestion`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* Expandable explanation */}
              {isExpanded && rich?.explanation && (
                <div className="px-4 pb-3">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Why this was suggested
                    </p>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {rich.explanation}
                    </p>
                    {rich.source && (
                      <p className="text-[10px] text-slate-400">
                        Basis: {rich.source}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Validation status ── */}
      {validation && (
        <div className={`px-4 py-2.5 border-t border-slate-200 text-xs font-medium flex items-center gap-1.5 ${
          validation.isValid ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"
        }`}>
          {validation.isValid
            ? <><Check className="h-3 w-3 shrink-0" aria-hidden="true" />Section numbers found in BNS 2023 database</>
            : <><AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />{validation.summary}</>
          }
        </div>
      )}

      {/* ── Safety disclaimer ── */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
        <p className="text-[10px] text-slate-500 leading-relaxed">
          <strong className="text-slate-600 font-semibold">Note:</strong>{" "}
          This is an AI-generated suggestion, not an official legal determination.
          The applicable legal sections are determined by the investigating police officer.
          BNS §303 = Theft · BNS §304 = Snatching (Bharatiya Nyaya Sanhita 2023).
        </p>
      </div>
    </div>
  );
}
