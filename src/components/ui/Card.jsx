import { cn } from "@/utils";

export function Card({ children, variant = "default", className, ...props }) {
  const variantStyles = {
    default:     "bg-white rounded-2xl border border-slate-200/80 shadow-3d-card relative overflow-hidden",
    elevated:    "bg-white rounded-2xl border border-slate-200/80 shadow-3d-floating relative overflow-hidden",
    interactive: "bg-white rounded-2xl border border-slate-200/80 shadow-3d-card card-3d card-3d-interactive relative overflow-hidden",
    glass:       "glass-surface rounded-2xl shadow-3d-card relative overflow-hidden",
    flat:        "bg-white rounded-2xl border border-slate-200 relative overflow-hidden",
  };

  return (
    <div className={cn(variantStyles[variant] || variantStyles.default, className)} {...props}>
      {/* Subtle top ambient light edge */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none" />
      {children}
    </div>
  );
}

export function CardHeader({ children, className }) {
  return <div className={cn("px-5 py-4 sm:px-6 sm:py-4.5 border-b border-slate-100/90", className)}>{children}</div>;
}

export function CardBody({ children, className }) {
  return <div className={cn("p-5 sm:p-6", className)}>{children}</div>;
}

export function CardFooter({ children, className }) {
  return <div className={cn("px-5 py-4 sm:px-6 sm:py-4 border-t border-slate-100/90 bg-slate-50/40", className)}>{children}</div>;
}
