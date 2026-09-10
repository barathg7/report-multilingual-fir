import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Mic, History, BarChart2, Shield, Wifi, WifiOff, LogOut, User, Home } from "lucide-react";
import React, { useState } from "react";

const navItems = [
  { to: "/dashboard",        icon: LayoutDashboard, label: "Dashboard"   },
  { to: "/record-statement", icon: Mic,             label: "New FIR"     },
  { to: "/fir-history",      icon: History,         label: "FIR History" },
  { to: "/analytics",        icon: BarChart2,       label: "Analytics"   },
];

function useOnline() {
  const [online, setOnline] = React.useState(navigator.onLine);
  React.useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

export default function Layout() {
  const online   = useOnline();
  const navigate = useNavigate();

  const [citizen, setCitizen] = useState(() => {
    try {
      const raw = localStorage.getItem("citizen_user") || sessionStorage.getItem("citizen_user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const handleCitizenLogout = () => {
    sessionStorage.setItem("citizen_explicit_logout", "true");
    localStorage.removeItem("citizen_user");
    sessionStorage.removeItem("citizen_user");
    setCitizen(null);
    navigate("/citizen-login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-slate-200
        shadow-[2px_0_12px_-4px_rgba(15,23,42,0.06)]">

        {/* Brand panel */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-civic-navy-900 flex items-center justify-center
              shadow-[0_3px_10px_-2px_rgba(15,23,42,0.35),0_1px_0_0_rgba(255,255,255,0.07)_inset] shrink-0">
              <Shield className="h-[15px] w-[15px] text-civic-blue-400" />
            </div>
            <div className="flex flex-col leading-none">
              <p className="text-[13px] font-extrabold text-civic-navy-900 tracking-tight leading-none">REPORT</p>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5 tracking-wide">Citizen Portal</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? "bg-civic-blue-50 text-civic-blue-700 font-semibold shadow-[0_1px_4px_0_rgba(29,78,216,0.10)]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
                    isActive ? "bg-civic-blue-100" : "group-hover:bg-slate-100"
                  }`}>
                    <Icon className="h-[15px] w-[15px] shrink-0" />
                  </div>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-slate-100 space-y-2">
          {/* Citizen status capsule */}
          {citizen && (
            <div className="px-3 py-2.5 bg-civic-blue-50 border border-civic-blue-200/60 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-civic-blue-600">Citizen</span>
                <button
                  onClick={handleCitizenLogout}
                  className="inline-flex items-center gap-0.5 text-[10px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer transition-colors"
                  title="Log out citizen session"
                >
                  <LogOut className="h-2.5 w-2.5" />
                  <span>Logout</span>
                </button>
              </div>
              <p className="text-xs font-bold text-civic-navy-900 truncate">{citizen.name}</p>
              <p className="text-[10px] text-slate-500 font-mono">+91 {citizen.phone}</p>
            </div>
          )}

          {/* Online/Offline pill */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            online
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
              : "bg-rose-50 text-rose-600 border border-rose-200/60"
          }`}>
            {online
              ? <Wifi className="h-3.5 w-3.5" />
              : <WifiOff className="h-3.5 w-3.5" />}
            {online ? "Online" : "Offline — Limited Mode"}
          </div>

          {/* Home link */}
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-50"
          >
            <Home className="h-3.5 w-3.5" />
            ← Home
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0
          shadow-[0_1px_4px_0_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-civic-navy-900 flex items-center justify-center
              shadow-[0_2px_8px_-2px_rgba(15,23,42,0.3)]">
              <Shield className="h-3.5 w-3.5 text-civic-blue-400" />
            </div>
            <p className="text-sm font-extrabold text-civic-navy-900 tracking-tight">REPORT</p>
          </div>
          <div className="flex items-center gap-2">
            {citizen && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-civic-blue-50 border border-civic-blue-200/60 text-xs">
                <User className="h-3 w-3 text-civic-blue-600" />
                <span className="font-semibold text-civic-navy-900 max-w-[70px] truncate">{citizen.name}</span>
                <button
                  onClick={handleCitizenLogout}
                  className="text-rose-500 hover:text-rose-700 ml-0.5 transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold ${
              online
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                : "bg-rose-50 text-rose-600 border border-rose-200/60"
            }`}>
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Online" : "Offline"}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav className="md:hidden flex items-center justify-around bg-white border-t border-slate-200 shrink-0 pb-safe
          shadow-[0_-1px_4px_0_rgba(15,23,42,0.05)]">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors min-h-[56px] justify-center ${
                  isActive ? "text-civic-blue-700" : "text-slate-400"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? "bg-civic-blue-50" : ""}`}>
                    <Icon className="h-5 w-5" />
                    {isActive && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-civic-blue-600" />
                    )}
                  </div>
                  <span className={`font-medium text-[10px] ${isActive ? "text-civic-blue-700" : ""}`}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

      </div>
    </div>
  );
}
