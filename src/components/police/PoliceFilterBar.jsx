// src/components/police/PoliceFilterBar.jsx — Search, Filter Tabs & Sort Controls
import { Search, X, ArrowUpDown, SlidersHorizontal } from "lucide-react";

export default function PoliceFilterBar({
  search,
  onSearchChange,
  filterStatus,
  onFilterChange,
  counts,
  sortBy,
  onSortChange,
}) {
  const filterTabs = [
    { id: "all", label: "All Cases", count: counts?.total ?? 0 },
    { id: "submitted", label: "New / Intake", count: counts?.submitted ?? 0 },
    { id: "investigating", label: "Investigating", count: counts?.investigating ?? 0 },
    { id: "resolved", label: "Resolved", count: counts?.resolved ?? 0 },
    { id: "closed", label: "Closed", count: counts?.closed ?? 0 },
    { id: "fake_fir", label: "Fake FIR", count: counts?.fake ?? 0, danger: true },
  ];

  return (
    <div className="space-y-3">
      {/* Top row: Search input + Sort dropdown */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search FIR ID, Ack No, complainant name, phone, crime classification, location..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-300/80 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs transition font-medium"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="Clear search"
              aria-label="Clear search query"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort selector */}
        {onSortChange && (
          <div className="flex items-center gap-1.5 shrink-0 bg-white border border-slate-300/80 rounded-xl px-3 py-2 shadow-2xs min-h-[44px]">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden md:inline">
              Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
              aria-label="Sort complaints ledger"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="completeness">Completeness %</option>
            </select>
          </div>
        )}
      </div>

      {/* Filter Tabs Scrollable Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none">
        {filterTabs.map((tab) => {
          const isActive = filterStatus === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onFilterChange(tab.id)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer select-none border min-h-[36px] ${
                isActive
                  ? tab.danger
                    ? "bg-rose-700 text-white border-rose-700 shadow-xs"
                    : "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200/90"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                  isActive
                    ? "bg-white/25 text-white"
                    : tab.danger
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
