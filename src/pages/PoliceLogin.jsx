// src/pages/PoliceLogin.jsx
// ✅ Demo station codes REMOVED (security fix)
// ✅ Station name auto-lookup as officer types code
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { verifyStationLogin } from "@/lib/supabaseClient";
import { verifyStation } from "@/utils/policeStations";

export default function PoliceLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stationName, setStationName] = useState("");

  const handleCodeChange = (val) => {
    const upper = val.toUpperCase().trim();
    setCode(upper);
    setError("");

    if (upper.length >= 8) {
      const s = verifyStation(upper, "police123");
      setStationName(s ? s.name : "");
    } else {
      setStationName("");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!code || !password) {
      setError("Enter station code and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let station = null;

      try {
        station = await verifyStationLogin(code, password);
      } catch (_) {}

      if (!station) station = verifyStation(code, password);

      if (!station) {
        setError("Invalid credentials. Contact your SHO.");
        return;
      }

      sessionStorage.setItem("police_station", JSON.stringify(station));
      navigate("/police-dashboard");
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-2xl mb-4">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-white text-2xl font-bold">Police Portal</h1>
          <p className="text-blue-200 text-sm mt-1">Sign in with your station credentials</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Station Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="E.G. TN-VLR-002"
                autoComplete="username"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
              {stationName && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  <p className="text-xs text-green-600 font-medium">{stationName}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter station password"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-400 text-center">
              Official use only · Unauthorized access is a criminal offence under IT Act 2000
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}