import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Mic, History, BarChart2, Shield, Wifi, WifiOff } from "lucide-react";
import React from "react";

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

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── DESKTOP SIDEBAR (hidden on mobile) ── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-gray-200">

        {/* Logo */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-700 leading-none">REPORT</p>
              <p className="text-xs text-gray-400 mt-0.5">TN Police FIR System</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 space-y-2">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
            online ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}>
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {online ? "Online" : "Offline"}
          </div>
          <button
            onClick={() => navigate("/")}
            className="w-full text-left px-3 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Home
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-bold text-blue-700">REPORT</p>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            online ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}>
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? "Online" : "Offline"}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>

        {/* ── MOBILE BOTTOM NAV (hidden on desktop) ── */}
        <nav className="md:hidden flex items-center justify-around bg-white border-t border-gray-200 shrink-0 pb-safe">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                  isActive ? "text-blue-600" : "text-gray-500"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-lg transition-colors ${isActive ? "bg-blue-50" : ""}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`font-medium ${isActive ? "text-blue-600" : ""}`}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

      </div>
    </div>
  );
}
