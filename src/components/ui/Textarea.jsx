import { cn } from "@/utils";

export default function Textarea({ className, label, rows = 4, error, helper, required, id, ...props }) {
  const taId = id || (label ? label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : undefined);
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={taId} className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-1.5">
          {label}
          {required && <span className="text-rose-500 font-bold" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        id={taId}
        rows={rows}
        className={cn(
          "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-white placeholder:text-slate-400",
          "focus:outline-none focus:ring-2 focus:ring-civic-blue-500 focus:border-civic-blue-400",
          "disabled:opacity-50 resize-y transition-all",
          "shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]",
          error && "border-rose-400 focus:ring-rose-400",
          className
        )}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${taId}-error` : helper ? `${taId}-helper` : undefined}
        {...props}
      />
      {error && <p id={`${taId}-error`} className="text-xs text-rose-600 mt-1.5">⚠ {error}</p>}
      {!error && helper && <p id={`${taId}-helper`} className="text-xs text-slate-400 mt-1.5">{helper}</p>}
    </div>
  );
}
