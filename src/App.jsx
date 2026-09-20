import { useState, useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import LandingPage from "./pages/LandingPage";
import CitizenLogin from "./pages/CitizenLogin";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import RecordStatement from "./pages/RecordStatement";
import FIRHistory from "./pages/FIRHistory";
import Analytics from "./pages/Analytics";
import PoliceLogin from "./pages/PoliceLogin";
import PoliceDashboard from "./pages/PoliceDashboard";
import EmergencySecurity from "./components/kavalan/EmergencySecurity";

function AppRoutes() {
  const [showEmergency, setShowEmergency] = useState(false);

  // Listen for the "open-sos-panel" event fired by LandingPage's inline button
  useEffect(() => {
    const handler = () => setShowEmergency(true);
    window.addEventListener("open-sos-panel", handler);
    return () => window.removeEventListener("open-sos-panel", handler);
  }, []);

  // Global QuickShield Triggers: Ctrl+Shift+E and deep links (#quickshield / ?sos=quickshield)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "E" || e.key === "e")) {
        e.preventDefault();
        setShowEmergency(true);
      }
    };
    const checkDeepLink = () => {
      if (window.location.hash.includes("quickshield") || window.location.search.includes("quickshield")) {
        setShowEmergency(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("hashchange", checkDeepLink);
    checkDeepLink();
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("hashchange", checkDeepLink);
    };
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/citizen-portal" element={<RecordStatement />} />
        <Route path="/citizen-login" element={<CitizenLogin />} />
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



      {/* Single global SOS modal — only one instance ever */}
      <EmergencySecurity
        showPanel={showEmergency}
        onClosePanel={() => setShowEmergency(false)}
      />
    </>
  );
}

// Production SPA HashRouter Bridge: If loaded with a pathname like /police-login, sync to /#/police-login
if (typeof window !== "undefined" && window.location.pathname && window.location.pathname !== "/") {
  const p = window.location.pathname;
  if (!p.startsWith("/api/")) {
    const s = window.location.search || "";
    const h = window.location.hash || "";
    if (!h || h === "#/") {
      window.location.replace(`/#${p}${s}`);
    }
  }
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
