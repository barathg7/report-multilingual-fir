import { cn } from "@/utils";

const colors = {
  blue:    "bg-blue-50 text-blue-700 border-blue-200/80",
  green:   "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  yellow:  "bg-amber-50 text-amber-700 border-amber-200/80",
  amber:   "bg-amber-50 text-amber-700 border-amber-200/80",
  red:     "bg-rose-50 text-rose-700 border-rose-200/80",
  rose:    "bg-rose-50 text-rose-700 border-rose-200/80",
  gray:    "bg-slate-100 text-slate-700 border-slate-200",
  slate:   "bg-slate-100 text-slate-700 border-slate-200",
  purple:  "bg-purple-50 text-purple-700 border-purple-200/80",
  navy:    "bg-slate-900 text-blue-300 border-slate-700",
};

const dotColors = {
  blue:    "bg-blue-500",
  green:   "bg-emerald-500",
  emerald: "bg-emerald-500",
  yellow:  "bg-amber-500",
  amber:   "bg-amber-500",
  red:     "bg-rose-500",
  rose:    "bg-rose-500",
  gray:    "bg-slate-400",
  slate:   "bg-slate-400",
  purple:  "bg-purple-500",
  navy:    "bg-blue-400",
};

export default function Badge({ children, color = "gray", dot = false, size = "sm", className }) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold border shadow-2xs tracking-wide uppercase",
        colors[color] || colors.gray,
        sizeClasses,
        className
      )}
    >
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[color] || "bg-slate-400")}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
