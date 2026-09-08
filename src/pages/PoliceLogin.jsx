// src/pages/PoliceLogin.jsx — Hardened Official Station Police Authentication Portal
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle, BadgeCheck } from "lucide-react";
import { authenticatePolice } from "@/lib/policeAuth";
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
      setError("Please provide station code and officer credentials.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await authenticatePolice(code, password, badge || "SHO-DUTY");
      navigate("/police-dashboard");
    } catch (err) {
      setError(err.message || "Authentication failed. Contact your jurisdictional nodal officer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-slate-950 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-2xl mb-4 border border-white/20 shadow-xl backdrop-blur-sm">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Police Portal</h1>
          <p className="text-blue-200 text-xs mt-1">Authorized Station & Investigating Officer Access</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4 border border-slate-200">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Station Jurisdiction Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="E.G. TN-CHN-001"
                autoComplete="username"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-600 uppercase transition"
              />
              {stationName && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <p className="text-xs text-emerald-700 font-semibold">{stationName}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Officer Badge / Service ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value.toUpperCase())}
                  placeholder="E.G. SHO-4102"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 uppercase transition"
                />
                <BadgeCheck className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Station Secure Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter encrypted password"
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 leading-snug">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying Credentials…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Sign In to Station Console
                </>
              )}
            </button>
          </form>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-[11px] text-gray-500 text-center leading-relaxed">
              Official Police Use Only. Plaintext default credentials have been disabled. Station authorization is governed under IT Act 2000 and BNSS 2023.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}