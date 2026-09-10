import { cn } from "@/utils";

const styles = {
  primary:   "bg-gradient-to-b from-blue-600 to-blue-700 text-white border border-blue-700/80 shadow-3d-button-primary hover:from-blue-500 hover:to-blue-600 active:translate-y-0.5 active:shadow-3d-inset",
  secondary: "bg-gradient-to-b from-slate-100 to-slate-200/90 text-slate-800 border border-slate-300/80 shadow-3d-button hover:from-white hover:to-slate-100 active:translate-y-0.5 active:shadow-3d-inset",
  danger:    "bg-gradient-to-b from-rose-600 to-rose-700 text-white border border-rose-700/80 shadow-3d-button-danger hover:from-rose-500 hover:to-rose-600 active:translate-y-0.5 active:shadow-3d-inset",
  outline:   "border border-slate-300 bg-white text-slate-700 shadow-3d-button hover:bg-slate-50 hover:border-slate-400 active:translate-y-0.5 active:shadow-3d-inset",
  ghost:     "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200",
  success:   "bg-gradient-to-b from-emerald-600 to-emerald-700 text-white border border-emerald-700/80 shadow-3d-button-success hover:from-emerald-500 hover:to-emerald-600 active:translate-y-0.5 active:shadow-3d-inset",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs rounded-lg min-h-[34px]",
  md: "px-4 py-2.5 text-sm rounded-xl min-h-[44px]",
  lg: "px-6 py-3.5 text-base rounded-xl font-semibold min-h-[48px]",
  xl: "px-8 py-4 text-lg rounded-2xl font-bold min-h-[54px]",
};

export default function Button({ children, variant = "primary", size = "md", className, disabled, full, ...props }) {
  return (
    <button
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none gap-2 select-none cursor-pointer",
        styles[variant] || styles.primary,
        sizes[size]     || sizes.md,
        full && "w-full",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
