import { CheckCircle } from "lucide-react";
import { cn } from "@/utils";

export default function StepBar({ steps, current, onStepClick }) {
  const currentStep = steps[current] || steps[0];

  return (
    <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-14 z-20 shadow-xs">
      {/* ── MOBILE VIEW: Compact Progress Header + Segmented Bar ── */}
      <div className="sm:hidden px-4 py-2.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
              {current + 1}
            </span>
            <span>{currentStep.label}</span>
          </span>
          <span className="text-[11px] font-mono text-slate-500 font-semibold">
            Step {current + 1} of {steps.length}
          </span>
        </div>

        {/* Segmented mini-bars */}
        <div className="grid grid-flow-col gap-1.5 h-1.5 w-full">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-full transition-all duration-300",
                i < current
                  ? "bg-emerald-500"
                  : i === current
                  ? "bg-blue-600 shadow-xs"
                  : "bg-slate-200"
              )}
            />
          ))}
        </div>
      </div>

      {/* ── DESKTOP VIEW: Connected Dimensional Stepper ── */}
      <div className="hidden sm:flex items-center justify-center py-3 px-4 max-w-4xl mx-auto">
        <div className="flex items-center gap-0 w-full justify-between">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const done   = i < current;
            const active = i === current;
            const isClickable = onStepClick && (done || i === 0);

            return (
              <div key={step.label} className="flex items-center flex-1 last:flex-initial">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(i)}
                  disabled={!isClickable && !active}
                  className={cn(
                    "flex flex-col items-center group focus:outline-none transition-all",
                    isClickable ? "cursor-pointer hover:opacity-90 active:scale-95" : "cursor-default"
                  )}
                  title={isClickable ? `Jump to ${step.label}` : step.label}
                >
                  <div
                    className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 border",
                      done && "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white border-emerald-600 shadow-3d-button",
                      active && "bg-gradient-to-b from-blue-600 to-blue-700 text-white border-blue-700 ring-4 ring-blue-500/20 shadow-3d-button scale-105",
                      !done && !active && "bg-slate-100 text-slate-400 border-slate-200"
                    )}
                  >
                    {done ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span
                    className={cn(
                      "text-[11px] mt-1.5 font-semibold transition-colors tracking-tight whitespace-nowrap",
                      active ? "text-blue-700 font-bold" : done ? "text-slate-700" : "text-slate-400"
                    )}
                  >
                    {step.label}
                  </span>
                </button>

                {i < steps.length - 1 && (
                  <div className="flex-1 mx-2 mb-4">
                    <div
                      className={cn(
                        "h-1 rounded-full transition-all duration-300",
                        done ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-slate-200"
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
