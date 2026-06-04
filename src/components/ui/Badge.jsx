import { cn } from "@/utils";

const colors = {
  blue:   "bg-blue-100 text-blue-700",
  green:  "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red:    "bg-red-100 text-red-700",
  gray:   "bg-gray-100 text-gray-600",
  purple: "bg-purple-100 text-purple-700",
};

export default function Badge({ children, color = "gray", className }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium", colors[color], className)}>
      {children}
    </span>
  );
}
