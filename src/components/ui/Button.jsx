import { cn } from "@/utils";

const styles = {
  primary:   "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
  secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  danger:    "bg-red-600 text-white hover:bg-red-700",
  outline:   "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
  ghost:     "text-gray-600 hover:bg-gray-100",
  success:   "bg-green-600 text-white hover:bg-green-700",
};
const sizes = {
  sm:  "px-3 py-1.5 text-xs rounded-md",
  md:  "px-4 py-2 text-sm rounded-lg",
  lg:  "px-6 py-3 text-base rounded-xl font-semibold",
  xl:  "px-8 py-4 text-lg rounded-xl font-bold",
};

export default function Button({ children, variant = "primary", size = "md", className, disabled, full, ...props }) {
  return (
    <button
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed gap-2",
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
