/**
 * SubmissionSummary — Stage 4 component
 *
 * Renders the submission success state clearly distinguishing:
 *  1. "Complaint Submitted Successfully" headline
 *  2. "Your Acknowledgement Reference" — citizen-generated tracking ID
 *  3. "Official FIR Number" — explicitly stated as assigned by police ONLY
 *  4. Current status badge ("Submitted — Pending Police Registration")
 *  5. Offline draft warning if applicable
 *  6. FIR document embed
 *  7. Download section
 *  8. Navigation actions
 *
 * SAFETY CONTRACT:
 *  - NEVER displays a client-generated ID as an "Official FIR Number"
 *  - The official FIR number row always says "Not yet assigned — pending police registration"
 *    unless an actual officialFirNumber is passed from the server
 *  - Does NOT invent or fabricate any official data
 *
 * Props:
 *  - firData: object      — the saved FIR record
 *  - isOnline: boolean    — to show offline sync notice
 *  - onNavigateHistory: fn
 *  - onFileAnother: fn
 *  - location: object|null — GPS location object for download
 *  - FIRDocument: component
 *  - FIRDownload: component
 */
import { CheckCircle, FileText, WifiOff, ClipboardList, Clock } from "lucide-react";
import Button from "@/components/ui/Button";

export default function SubmissionSummary({
  firData,
  isOnline,
  onNavigateHistory,
  onFileAnother,
  location,
  FIRDocument,
  FIRDownload,
}) {
  const ackRef = firData?.submissionId || firData?.id || "—";
  // Official FIR number: only use server-assigned values.
  // A client-generated UUID or draft ID is never an official FIR number.
  const officialFirNumber = firData?.officialFirNumber || null;

  return (
    <div className="space-y-6 py-2">

      {/* ── Success header ── */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center
                          shadow-[0_4px_20px_-4px_rgba(16,185,129,0.25)] ring-4 ring-emerald-50">
            <CheckCircle className="h-8 w-8 text-emerald-600" aria-hidden="true" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-civic-navy-900">Complaint Submitted Successfully</h2>
          <p className="text-sm text-slate-500 mt-1">
            உங்கள் புகார் பதிவு செய்யப்பட்டது · Your complaint has been recorded
          </p>
        </div>
      </div>

      {/* ── Reference details card ── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_6px_-2px_rgba(15,23,42,0.06)]">

        {/* Acknowledgement Reference */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                <ClipboardList className="h-3 w-3" aria-hidden="true" />
                Your Acknowledgement Reference
              </p>
              <p className="font-mono text-base font-bold text-civic-navy-900 break-all">{ackRef}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                Use this reference to track your complaint. Keep it safe.
              </p>
            </div>
          </div>
        </div>

        {/* Official FIR Number — clearly distinguished */}
        <div className="px-4 py-4 border-b border-slate-100 bg-slate-50/60">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
            <FileText className="h-3 w-3" aria-hidden="true" />
            Official FIR Number
          </p>
          {officialFirNumber ? (
            <p className="font-mono text-base font-bold text-civic-navy-900">{officialFirNumber}</p>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                <Clock className="h-3 w-3" aria-hidden="true" />
                Not yet assigned
              </span>
              <span className="text-[10px] text-slate-400">
                Assigned by police upon formal registration
              </span>
            </div>
          )}
        </div>

        {/* Current status */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Current Status
          </p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-civic-blue-700
                             bg-civic-blue-50 border border-civic-blue-200 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-civic-blue-500 animate-pulse" aria-hidden="true" />
              Submitted — Pending Police Review
            </span>
          </div>
          {!isOnline && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-700
                            bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
              <WifiOff className="h-3 w-3" aria-hidden="true" />
              Saved locally — will sync when online
            </div>
          )}
        </div>
      </div>

      {/* ── FIR Document ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_6px_-2px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <FileText className="h-4 w-4 text-civic-blue-600" aria-hidden="true" />
            Complaint Summary
          </p>
        </div>
        <div className="p-4">
          <FIRDocument fir={firData} />
        </div>
      </div>

      {/* ── Download ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_6px_-2px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <FileText className="h-4 w-4 text-civic-blue-600" aria-hidden="true" />
            Download Official State FIR (DOCX format)
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            For submission at police station or personal record-keeping
          </p>
        </div>
        <div className="p-4">
          <FIRDownload fir={firData} location={location} />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3 justify-center flex-wrap">
        <Button onClick={onNavigateHistory}>
          View My Complaints
        </Button>
        <Button variant="outline" onClick={onFileAnother}>
          File Another Complaint
        </Button>
      </div>
    </div>
  );
}
