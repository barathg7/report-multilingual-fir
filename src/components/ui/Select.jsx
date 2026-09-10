import { cn } from "@/utils";
import { ChevronDown } from "lucide-react";

export default function Select({ className, label, options = [], placeholder = "Select...", value, onChange, required, helper, error, id, ...props }) {
  const selId = id || (label ? label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : undefined);
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selId} className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-1.5">
          {label}
          {required && <span className="text-rose-500 font-bold" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={selId}
          value={value}
          onChange={onChange}
          className={cn(
            "w-full h-11 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-white appearance-none",
            "focus:outline-none focus:ring-2 focus:ring-civic-blue-500 focus:border-civic-blue-400",
            "disabled:opacity-50 pr-8 transition-all",
            "shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]",
            error && "border-rose-400 focus:ring-rose-400",
            className
          )}
          aria-required={required}
          aria-invalid={!!error}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) =>
            typeof opt === "string"
              ? <option key={opt} value={opt}>{opt}</option>
              : <option key={opt.value} value={opt.value}>{opt.label}</option>
          )}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      </div>
      {error && <p className="text-xs text-rose-600 mt-1.5">⚠ {error}</p>}
      {!error && helper && <p className="text-xs text-slate-400 mt-1.5">{helper}</p>}
    </div>
  );
}
