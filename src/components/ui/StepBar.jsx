import { CheckCircle } from "lucide-react";
import { cn } from "@/utils";

export default function StepBar({ steps, current }) {
  return (
    <div className="flex items-center justify-center overflow-x-auto py-2 px-4 bg-white border-b border-gray-100">
      <div className="flex items-center gap-0 min-w-max">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const done   = i < current;
          const active = i === current;
          return (
            <div key={step.label} className="flex items-center">
              <div className="flex flex-col items-center w-16">
                <div className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center transition-all text-sm font-bold",
                  done   && "bg-green-500 text-white",
                  active && "bg-blue-600 text-white ring-4 ring-blue-100",
                  !done && !active && "bg-gray-100 text-gray-400"
                )}>
                  {done ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                </div>
                <p className={cn("text-xs mt-1 text-center leading-tight whitespace-nowrap",
                  active ? "text-blue-600 font-semibold" : "text-gray-400"
                )}>
                  {step.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className={cn("h-0.5 w-6 mb-4 mx-0.5 transition-colors", done ? "bg-green-400" : "bg-gray-200")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
