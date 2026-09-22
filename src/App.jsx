import { useState, useEffect } from "react";
import { HashRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const navigate = useNavigate();

  // Listen for the "open-sos-panel" event fired by LandingPage's inline button
  useEffect(() => {
    const handler = () => setShowEmergency(true);
    window.addEventListener("open-sos-panel", handler);
    return () => window.removeEventListener("open-sos-panel", handler);
  }, []);

  // Global QuickShield & SOS Triggers: Ctrl+Shift+E and deep links (#quickshield / #sos / #emergency / search params)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "E" || e.key === "e")) {
        e.preventDefault();
        setShowEmergency(true);
      }
    };
    const checkDeepLink = () => {
      // 1. Exact matching for supported hash paths: #quickshield, #/quickshield, #sos, #/sos, #emergency, #/emergency
      const rawHash = window.location.hash || "";
      const hashPath = rawHash.replace(/^#\/?/, "").split("?")[0].replace(/\/+$/, "").toLowerCase();
      const isMatchingHash = hashPath === "quickshield" || hashPath === "sos" || hashPath === "emergency";

      // 2. Intentional matching for supported query parameter flags: ?sos=quickshield, ?quickshield, ?sos, ?emergency
      const searchParams = new URLSearchParams(window.location.search);
      const hashQueryIdx = rawHash.indexOf("?");
      const hashParams = hashQueryIdx !== -1 ? new URLSearchParams(rawHash.slice(hashQueryIdx)) : null;

      const hasParam = (key) => searchParams.has(key) || Boolean(hashParams?.has(key));
      const getParam = (key) => (searchParams.get(key) || hashParams?.get(key) || "").toLowerCase();

      const sosVal = getParam("sos");
      const emergencyVal = getParam("emergency");

      const isMatchingSearch =
        hasParam("quickshield") ||
        sosVal === "quickshield" ||
        (hasParam("sos") && (sosVal === "" || sosVal === "true" || sosVal === "1" || sosVal === "open")) ||
        (hasParam("emergency") && (emergencyVal === "" || emergencyVal === "true" || emergencyVal === "1" || emergencyVal === "open"));

      if (isMatchingHash || isMatchingSearch) {
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

  // Automatically open SOS Command Terminal when visiting /sos or /emergency routes
  useEffect(() => {
    if (location.pathname === "/sos" || location.pathname === "/emergency") {
      setShowEmergency(true);
    }
  }, [location.pathname]);

  const handleCloseEmergency = () => {
    setShowEmergency(false);
    if (location.pathname === "/sos" || location.pathname === "/emergency") {
      navigate("/", { replace: true });
    }
  };

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sos" element={<LandingPage />} />
        <Route path="/emergency" element={<LandingPage />} />
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
        onClosePanel={handleCloseEmergency}
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
