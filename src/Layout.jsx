import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Mic,
  History,
  BarChart2,
  Shield,
  Wifi,
  WifiOff,
  LogOut,
  User,
  Home,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import React, { useState } from "react";

const navItems = [
  { to: "/dashboard",        icon: LayoutDashboard, label: "Dashboard",   badge: "Live" },
  { to: "/record-statement", icon: Mic,             label: "New FIR",     badge: "Voice" },
  { to: "/fir-history",      icon: History,         label: "FIR History", badge: null },
  { to: "/analytics",        icon: BarChart2,       label: "Analytics",   badge: null },
];

function useOnline() {
  const [online, setOnline] = React.useState(navigator.onLine);
  React.useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
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
    <div className="flex h-screen overflow-hidden civic-mesh-bg text-slate-800">

      {/* ── DESKTOP 3D GLASS DOCK SIDEBAR ── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-white/85 backdrop-blur-2xl border-r border-slate-200/80 shadow-3d-floating z-30">

        {/* Brand panel */}
        <div className="p-5 border-b border-slate-100/90 ambient-lighting">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center shadow-3d-button-primary border border-cyan-400/40 shrink-0">
              <Shield className="h-5 w-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            </div>
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black text-slate-900 tracking-tight">REPORT</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase">
                  v2.0
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 mt-1 tracking-wider uppercase">
                Citizen Portal
              </span>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3.5 space-y-1.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group relative flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-3d-button-primary"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all ${
                        isActive
                          ? "bg-white/20 text-white shadow-inner"
                          : "bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                    </div>
                    <span>{label}</span>
                  </div>

                  {badge && (
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isActive
                          ? "bg-cyan-400 text-slate-950 font-black shadow-sm"
                          : "bg-blue-50 text-blue-600 border border-blue-200/60"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="p-3.5 border-t border-slate-100/90 space-y-2.5">
          {/* Citizen status capsule */}
          {citizen ? (
            <div className="p-3 bg-gradient-to-br from-blue-50 via-white to-cyan-50/50 border border-blue-200/80 rounded-2xl shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-700 flex items-center gap-1">
                  <User className="h-3 w-3" /> Citizen
                </span>
                <button
                  onClick={handleCitizenLogout}
                  className="inline-flex items-center gap-1 text-[10px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer transition-colors"
                  title="Log out citizen session"
                >
                  <LogOut className="h-3 w-3" />
                  <span>Exit</span>
                </button>
              </div>
              <div className="leading-tight">
                <p className="text-xs font-black text-slate-900 truncate">{citizen.name}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">+91 {citizen.phone}</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => navigate("/citizen-login")}
              className="w-full flex items-center justify-between p-3 bg-blue-50/80 border border-blue-200 rounded-2xl text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Sign In / Verify ID</span>
              </div>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {/* Online/Offline Radar Pill */}
          <div
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              online
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                : "bg-rose-50 text-rose-700 border border-rose-200/80"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                online ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <span className="text-[11px]">{online ? "Live State Network" : "Offline Storage Active"}</span>
          </div>

          {/* Home Link */}
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Back to Public Portal</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT CANVAS ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Mobile top bar with 3D Cyber Styling */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shrink-0 shadow-sm z-30">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center border border-cyan-400/40 shadow-sm">
              <Shield className="h-4 w-4 text-cyan-400" />
            </div>
            <span className="text-sm font-black text-slate-900 tracking-tight">REPORT</span>
          </div>

          <div className="flex items-center gap-2">
            {citizen && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                <User className="h-3 w-3 text-blue-600" />
                <span className="font-bold text-slate-900 max-w-[80px] truncate">{citizen.name}</span>
                <button
                  onClick={handleCitizenLogout}
                  className="text-rose-500 hover:text-rose-700 ml-1"
                  title="Logout"
                >
                  <LogOut className="h-3 w-3" />
                </button>
              </div>
            )}
            <div
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold ${
                online
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              {online ? "Online" : "Offline"}
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <Outlet />
        </main>

        {/* ── MOBILE BOTTOM FLOATING DOCK ── */}
        <nav className="md:hidden flex items-center justify-around bg-white/95 backdrop-blur-2xl border-t border-slate-200/80 shrink-0 shadow-3d-floating py-1.5 px-2 z-30">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-1.5 text-xs transition-all min-h-[50px] justify-center rounded-xl ${
                  isActive
                    ? "text-blue-700 font-extrabold"
                    : "text-slate-400 font-medium hover:text-slate-700"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1.5 rounded-xl transition-all ${
                      isActive
                        ? "bg-blue-600 text-white shadow-3d-button-primary -translate-y-1"
                        : "hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] leading-none">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

      </div>
    </div>
  );
}
