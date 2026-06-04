import { cn } from "@/utils";
import { ChevronDown } from "lucide-react";

export default function Select({ className, label, options = [], placeholder = "Select...", value, onChange, ...props }) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className={cn(
            "w-full h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 pr-8",
            className
          )}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) =>
            typeof opt === "string"
              ? <option key={opt} value={opt}>{opt}</option>
              : <option key={opt.value} value={opt.value}>{opt.label}</option>
          )}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}
