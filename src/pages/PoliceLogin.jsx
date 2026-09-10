// src/pages/PoliceLogin.jsx — Hardened Official Station Police Authentication Terminal
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle,
  BadgeCheck, ArrowRight, Radio, Building2
} from "lucide-react";
import { authenticatePolice, getAuthenticatedStation } from "@/lib/policeAuth";
import { getStationByCode } from "@/utils/policeStations";

export default function PoliceLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [badge, setBadge] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stationName, setStationName] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      try {
        const sessionStation = await getAuthenticatedStation();
        if (sessionStation && active) {
          navigate("/police-dashboard", { replace: true });
          return;
        }
      } catch (_) {}

      if (active) {
        setCheckingSession(false);
      }
    }

    checkExistingSession();
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleCodeChange = (val) => {
    const upper = val.toUpperCase().trim();
    setCode(upper);
    setError("");

    if (upper.length >= 6) {
      const s = getStationByCode(upper);
      setStationName(s ? `${s.name} (${s.district})` : "");
    } else {
      setStationName("");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!code || !password) {
      setError("Please provide station jurisdiction code and officer credentials.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await authenticatePolice(code, password, badge || "SHO-DUTY");
      navigate("/police-dashboard", { replace: true });
    } catch (err) {
      setError(
        err.message ||
          "Authentication failed. Verify credentials or contact your jurisdictional nodal officer."
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30 shadow-xl">
            <Shield className="h-6 w-6 text-blue-400" />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            <span className="font-medium">Validating station security session...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">

      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">

        {/* Terminal Header & Emblem */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-900 text-white shadow-xl border border-blue-400/30 mb-1">
            <Shield className="h-8 w-8 drop-shadow" />
          </div>
          <h1 className="text-white text-2xl font-black tracking-tight">
            Police Command Terminal
          </h1>
          <div className="flex items-center justify-center gap-2 text-xs text-blue-200">
            <span className="inline-flex items-center gap-1 bg-blue-950/70 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-800/60 font-mono font-semibold">
              <Radio className="h-2.5 w-2.5 text-emerald-400 animate-pulse" />
              <span>TLS 1.3 SECURE PORTAL</span>
            </span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 space-y-5 border border-slate-200/90">

          <div className="border-b border-slate-100 pb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Jurisdictional Authentication
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Authorized Station Duty Officers & Investigating Personnel
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">

            {/* Station Jurisdiction Code */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Station Jurisdiction Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="E.G. TN-CHN-001"
                  autoComplete="username"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold tracking-wider text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 uppercase transition"
                />
                <Building2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              {stationName && (
                <div className="flex items-center gap-1.5 mt-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-800 font-bold truncate">{stationName}</p>
                </div>
              )}
            </div>

            {/* Officer Badge / Service ID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Officer Badge / Service ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value.toUpperCase())}
                  placeholder="E.G. SHO-4102 OR IO-DUTY"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 uppercase transition"
                />
                <BadgeCheck className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Station Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Station Security Key
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter encrypted station password"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-11 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
                  title={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 font-medium leading-snug">{error}</p>
              </div>
            )}

            {/* Submit Action */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying Credentials…</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Access Station Terminal</span>
                  <ArrowRight className="h-4 w-4 ml-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Statutory Footer */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              Official Police Use Only. Governed under <strong>Information Technology Act 2000</strong> & <strong>Bharatiya Nagarik Suraksha Sanhita 2023</strong>. Unauthorized access is punishable by law.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}