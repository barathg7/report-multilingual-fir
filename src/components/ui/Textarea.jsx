import { cn } from "@/utils";

export default function Textarea({ className, label, rows = 4, ...props }) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <textarea
        rows={rows}
        className={cn(
          "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-y transition-colors",
          className
        )}
        {...props}
      />
    </div>
  );
}
