// src/components/police/FakeFIRModal.jsx — Statutory Penal Prosecution Warning Modal
import { AlertOctagon, XCircle, Loader2, Scale, AlertTriangle } from "lucide-react";

export const FAKE_FIR_STATUTES = [
  {
    section: "BNS §217",
    desc: "Public servant framed incorrect record or false information with intent to cause injury — up to 2 years imprisonment.",
  },
  {
    section: "BNS §227",
    desc: "False charge of offence made with intent to injure — up to 7 years rigorous imprisonment + fine.",
  },
  {
    section: "IT Act §66D",
    desc: "Cheating by personation using computer resource — up to 3 years imprisonment + ₹1,00,000 statutory fine.",
  },
  {
    section: "IPC §182 / §211",
    desc: "Substantive penal transition provision for malicious, frivolous or fabricated police reports.",
  },
];

export default function FakeFIRModal({ fir, onClose, onConfirm, loading }) {
  if (!fir) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs px-4 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-rose-200 animate-in fade-in zoom-in-95 duration-150 my-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-rose-800 to-rose-900 px-6 py-4 flex items-center gap-3 text-white">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
            <AlertOctagon className="h-6 w-6 text-rose-200" />
          </div>
          <div>
            <p className="font-extrabold text-base leading-tight">Initiate Statutory Criminal Prosecution</p>
            <p className="text-rose-200 text-xs mt-0.5">Classification: Malicious / Fabricated / False FIR</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">

          {/* Statutory Provisions Box */}
          <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3.5 space-y-2.5">
            <p className="text-rose-950 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-rose-700" />
              <span>Applicable Indian Penal Provisions (BNS 2023 & IT Act)</span>
            </p>
            <div className="space-y-1.5">
              {FAKE_FIR_STATUTES.map(({ section, desc }) => (
                <div key={section} className="text-xs">
                  <span className="font-bold text-rose-900 mr-1.5">{section}:</span>
                  <span className="text-rose-800 leading-tight">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Complainant Target Record */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1">
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              Accused Complainant Record:
            </p>
            <p className="text-slate-900 font-extrabold text-sm">
              {fir.complainant_name || fir.complainantName || "Unknown Complainant"}
            </p>
            <p className="text-slate-600 font-mono text-xs">
              {fir.complainant_phone || fir.complainantPhone || "No Phone Recorded"} ·{" "}
              {fir.complainant_address || fir.complainantAddress || "No Address Recorded"}
            </p>
          </div>

          {/* Warning Warning Text */}
          <div className="flex items-start gap-2.5 text-slate-600 text-xs leading-relaxed bg-amber-50/60 border border-amber-200/80 rounded-xl p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Confirming this action will immediately mark the case as <strong>Prosecuted Fake FIR</strong>, freeze further citizen claims, transmit an alert to the jurisdictional supervisory officers, and initiate appropriate legal proceedings under applicable law.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer min-h-[44px]"
            >
              Cancel & Return
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-rose-900/20 transition cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span>Confirm & Prosecute</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
