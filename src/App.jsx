import { useState, useEffect } from "react";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import Layout from "./Layout";
import LandingPage from "./pages/LandingPage";
import CitizenLogin from "./pages/CitizenLogin";   {/* ← ADDED (new import) */}
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import RecordStatement from "./pages/RecordStatement";
import FIRHistory from "./pages/FIRHistory";
import Analytics from "./pages/Analytics";
import PoliceLogin from "./pages/PoliceLogin";
import PoliceDashboard from "./pages/PoliceDashboard";
import EmergencySecurity from "./components/kavalan/EmergencySecurity";

const CITIZEN_ROUTES = ["/", "/home", "/dashboard", "/record-statement", "/fir-history"];

function AppRoutes() {
  const [showEmergency, setShowEmergency] = useState(false);
  const location = useLocation();

  const onCitizenPage = CITIZEN_ROUTES.includes(location.pathname);

  // Listen for the "open-sos-panel" event fired by LandingPage's inline button
  useEffect(() => {
    const handler = () => setShowEmergency(true);
    window.addEventListener("open-sos-panel", handler);
    return () => window.removeEventListener("open-sos-panel", handler);
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/citizen-login" element={<CitizenLogin />} />   {/* ← ADDED (new route) */}
        <Route path="/home" element={<Home />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/record-statement" element={<RecordStatement />} />
          <Route path="/fir-history" element={<FIRHistory />} />
        </Route>
        <Route path="/police-login" element={<PoliceLogin />} />
        <Route path="/police-dashboard" element={<PoliceDashboard />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>

      {/* Floating SOS button — shown on citizen pages EXCEPT landing (landing has its own inline button) */}
      {onCitizenPage && location.pathname !== "/" && (
        <button
          onClick={() => setShowEmergency(true)}
          className="fixed bottom-24 right-5 z-[9998] flex items-center gap-2 rounded-full bg-red-700 hover:bg-red-800 text-white px-4 py-3 shadow-2xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
          title="Emergency SOS"
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#fca5a5",
              animation: "sos-pulse-fab 1s ease-in-out infinite alternate",
              flexShrink: 0,
            }}
          />
          SOS
          <style>{`
            @keyframes sos-pulse-fab {
              from { opacity: 0.5; }
              to   { opacity: 1; box-shadow: 0 0 8px #fca5a5; }
            }
          `}</style>
        </button>
      )}

      {/* Single global SOS modal — only one instance ever */}
      <EmergencySecurity
        showPanel={showEmergency}
        onClosePanel={() => setShowEmergency(false)}
      />
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
