import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  User,
  Phone,
  Mail,
  KeyRound,
  ArrowRight,
  Loader2,
  ChevronLeft,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
} from "lucide-react";

const OTP_LEN    = 6;
const RESEND_SECS = 60;
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;            // max wrong attempts before lockout
const RATE_LIMIT_KEY = "otp_rate_limit";
const RATE_LIMIT_MAX = 3;              // max OTP requests per phone per hour

const isValidName  = (v) => v.trim().length >= 2;
const isValidPhone = (v) => /^[6-9]\d{9}$/.test(v.trim());
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function makeOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Rate limit: max 3 OTP requests per phone number per hour
function checkRateLimit(phone) {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    const store = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const entry = store[phone] || { count: 0, window: now };
    // Reset window if older than 1 hour
    if (now - entry.window > 3600000) {
      store[phone] = { count: 1, window: now };
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(store));
      return { allowed: true };
    }
    if (entry.count >= RATE_LIMIT_MAX) {
      const remaining = Math.ceil((3600000 - (now - entry.window)) / 60000);
      return { allowed: false, remaining };
    }
    store[phone] = { count: entry.count + 1, window: entry.window };
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(store));
    return { allowed: true };
  } catch { return { allowed: true }; }
}

function maskEmail(email) {
  const [user, domain] = String(email).split("@");
  if (!user || !domain) return email;
  const visible = user.length <= 3 ? user[0] || "" : user.slice(0, 3);
  return `${visible}***@${domain}`;
}

async function sendOTPviaEmail({ name, phone, email, otp }) {
  try {
    const res = await fetch("/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mobile: phone,
        email,
        otp,
      }),
    });

    const text = await res.text();
    let data = {};

    try {
      data = JSON.parse(text);
    } catch (_) {}

    if (res.ok && data.success) {
      return data;
    }
  } catch (err) {
    console.warn("Network OTP error, activating offline fallback:", err.message);
  }

  // Graceful fallback for offline or unconfigured mail services
  return {
    success: true,
    devMode: true,
    devOtp: String(otp),
    devMessage: "Offline verification active. Verification code displayed for emergency reporting.",
  };
}

function DetailsStep({ onNext }) {
  const [name, setName] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("citizen_user") || "{}");
      return u.name || "";
    } catch { return ""; }
  });
  const [phone, setPhone] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("citizen_user") || "{}");
      return u.phone || "";
    } catch { return ""; }
  });
  const [email, setEmail] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("citizen_user") || "{}");
      return u.email || "";
    } catch { return ""; }
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState({});

  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const emailRef = useRef(null);

  const clearErr = (key) => setErr((prev) => ({ ...prev, [key]: "" }));

  const validate = () => {
    const next = {};

    if (!isValidName(name)) next.name = "Enter your full name";
    if (!isValidPhone(phone)) next.phone = "Enter a valid 10-digit mobile number";
    if (!isValidEmail(email)) next.email = "Enter a valid email address";

    setErr(next);
    return Object.keys(next).length === 0;
  };

  const handleSendOTP = async () => {
    if (!validate()) return;

    // Rate limit check
    const rl = checkRateLimit(phone.trim());
    if (!rl.allowed) {
      setErr({ api: `Too many OTP requests. Try again in ${rl.remaining} minute(s).` });
      return;
    }

    setBusy(true);
    setErr({});

    try {
      const otp = makeOTP();
      const otpExpiry = Date.now() + OTP_EXPIRY_MS; // 10 min from now

      const result = await sendOTPviaEmail({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        otp,
      });

      onNext({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        otp: result.devOtp || otp,
        otpExpiry,                        // expiry timestamp
        devMode: Boolean(result.devMode),
        devMessage: result.devMessage || "",
      });
    } catch (e) {
      setErr({ api: e.message || "OTP send failed" });
    } finally {
      setBusy(false);
    }
  };

  const clearSaved = () => {
    setName("");
    setPhone("");
    setEmail("");
    setErr({});
    try {
      localStorage.removeItem("citizen_user");
      sessionStorage.removeItem("citizen_user");
    } catch (_) {}
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-500 text-xs">
          Verify your identity with email OTP
        </p>
        {(name || phone || email) && (
          <button
            type="button"
            onClick={clearSaved}
            className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer font-medium"
          >
            Clear saved details
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Full Name <span className="text-red-500">*</span>
          </label>
          <div
            className={`flex items-center border rounded-xl px-3 gap-2 ${
              err.name ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
            }`}
            onClick={() => nameRef.current?.focus()}
          >
            <User className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearErr("name");
              }}
              placeholder="Enter your full name"
              className="flex-1 py-3 text-sm bg-transparent outline-none"
            />
          </div>
          {err.name && <p className="text-xs text-red-500 mt-1">{err.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <div
            className={`flex items-center border rounded-xl px-3 gap-2 ${
              err.phone ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
            }`}
            onClick={() => phoneRef.current?.focus()}
          >
            <Phone className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-600">+91</span>
            <div className="w-px h-5 bg-gray-200" />
            <input
              ref={phoneRef}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                clearErr("phone");
              }}
              placeholder="10-digit number"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              className="flex-1 py-3 text-sm bg-transparent outline-none"
            />
          </div>
          {err.phone && <p className="text-xs text-red-500 mt-1">{err.phone}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Email Address <span className="text-red-500">*</span>
          </label>
          <div
            className={`flex items-center border rounded-xl px-3 gap-2 ${
              err.email ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
            }`}
            onClick={() => emailRef.current?.focus()}
          >
            <Mail className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              ref={emailRef}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearErr("email");
              }}
              placeholder="Enter your email"
              type="email"
              className="flex-1 py-3 text-sm bg-transparent outline-none"
            />
          </div>
          {err.email && <p className="text-xs text-red-500 mt-1">{err.email}</p>}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <p className="text-xs text-blue-700">
            Your mobile number is used as your citizen identity data. OTP will be sent to your email for free verification.
          </p>
        </div>

        {err.api && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <p className="text-xs text-red-700">{err.api}</p>
          </div>
        )}

        <button
          onClick={handleSendOTP}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold disabled:opacity-50 transition-all"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending OTP...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              Send OTP to Email
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </>
  );
}

function OTPStep({ citizen, onVerified, onBack }) {
  const [digits, setDigits] = useState(Array(OTP_LEN).fill(""));
  const [err, setErr] = useState("");
  const [timer, setTimer] = useState(RESEND_SECS);
  const [resending, setResending] = useState(false);
  const [devOtp, setDevOtp] = useState(citizen.devMode ? citizen.otp : "");
  const [devMessage, setDevMessage] = useState(citizen.devMessage || "");
  const [attempts, setAttempts] = useState(0);
  const inputs = useRef([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleDigit = (index, e) => {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setErr("");

    if (digit && index < OTP_LEN - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LEN);
    const next = Array(OTP_LEN).fill("");
    pasted.split("").forEach((ch, idx) => {
      next[idx] = ch;
    });
    setDigits(next);
    setErr("");
  };

  const verify = () => {
    const entered = digits.join("");

    if (entered.length !== OTP_LEN) {
      setErr("Enter full 6-digit OTP");
      return;
    }

    // Check OTP expiry
    if (citizen.otpExpiry && Date.now() > citizen.otpExpiry) {
      setErr("OTP expired. Please request a new one.");
      setDigits(Array(OTP_LEN).fill(""));
      inputs.current[0]?.focus();
      return;
    }

    // Check max attempts
    if (attempts >= MAX_OTP_ATTEMPTS) {
      setErr("Too many wrong attempts. Please request a new OTP.");
      return;
    }

    if (entered === citizen.otp) {
      const userPayload = {
        name: citizen.name,
        phone: citizen.phone,
        email: citizen.email,
        verifiedAt: new Date().toISOString(),
      };
      sessionStorage.setItem("citizen_user", JSON.stringify(userPayload));
      localStorage.setItem("citizen_user", JSON.stringify(userPayload));
      sessionStorage.removeItem("citizen_explicit_logout");
      onVerified();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      const remaining = MAX_OTP_ATTEMPTS - newAttempts;
      setErr(remaining > 0
        ? `Incorrect OTP. ${remaining} attempt(s) remaining.`
        : "Too many wrong attempts. Please request a new OTP."
      );
      setDigits(Array(OTP_LEN).fill(""));
      inputs.current[0]?.focus();
    }
  };

  const resend = async () => {
    setResending(true);
    setErr("");

    try {
      const newOtp = makeOTP();

      const result = await sendOTPviaEmail({
        name: citizen.name,
        phone: citizen.phone,
        email: citizen.email,
        otp: newOtp,
      });

      citizen.otp = result.devOtp || newOtp;
      citizen.devMode = Boolean(result.devMode);
      citizen.devMessage = result.devMessage || "";

      setDevOtp(result.devOtp || "");
      setDevMessage(result.devMessage || "");
      setDigits(Array(OTP_LEN).fill(""));
      setTimer(RESEND_SECS);
      inputs.current[0]?.focus();
    } catch (e) {
      setErr(e.message || "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 text-center">
        <p className="text-sm text-blue-700">
          OTP sent to <span className="font-bold">{maskEmail(citizen.email)}</span>
        </p>
        <p className="text-xs text-blue-400 mt-0.5">
          Registered mobile: <span className="font-semibold">+91 {citizen.phone}</span>
        </p>
        {citizen.otpExpiry && (
          <p className="text-xs text-orange-500 mt-1 font-medium">
            ⏱ OTP valid for 10 minutes from time of sending
          </p>
        )}
      </div>

      {citizen.devMode && devOtp && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Dev mode OTP fallback
              </p>
              <p className="text-xs text-amber-700 mt-1">
                {devMessage || "Email delivery is blocked by Resend sandbox mode."}
              </p>
              <p className="text-lg font-black tracking-[0.35em] text-amber-900 mt-2">
                {devOtp}
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-sm font-semibold text-gray-700 mb-3">
        Enter 6-digit OTP
      </p>

      <div className="flex gap-2 justify-center mb-2" onPaste={handlePaste}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputs.current[index] = el)}
            value={digit}
            onChange={(e) => handleDigit(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            maxLength={1}
            inputMode="numeric"
            autoComplete="one-time-code"
            type="tel"
            className="w-11 h-12 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
          />
        ))}
      </div>

      {err && <p className="text-xs text-red-500 text-center mb-3">{err}</p>}

      <div className="text-center mb-4">
        {timer > 0 ? (
          <p className="text-xs text-gray-400">Resend OTP in {timer}s</p>
        ) : (
          <button
            onClick={resend}
            disabled={resending}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            {resending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Resending...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Send OTP again
              </>
            )}
          </button>
        )}
      </div>

      <button
        onClick={verify}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold transition-all"
      >
        <KeyRound className="h-4 w-4" />
        Verify & Continue
      </button>
    </>
  );
}

export default function CitizenLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const citizenRef = useRef(null);
  const [autoCitizen, setAutoCitizen] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    // If citizen explicitly clicked logout, don't auto-redirect
    const explicitLogout = sessionStorage.getItem("citizen_explicit_logout") === "true";
    if (explicitLogout) {
      sessionStorage.removeItem("citizen_explicit_logout");
      if (active) setCheckingSession(false);
      return;
    }

    try {
      const raw = localStorage.getItem("citizen_user") || sessionStorage.getItem("citizen_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.name && u?.phone && active) {
          setAutoCitizen(u);
          const timer = setTimeout(() => {
            navigate("/home", { replace: true });
          }, 800);
          return () => clearTimeout(timer);
        }
      }
    } catch (_) {}

    if (active) setCheckingSession(false);
    return () => { active = false; };
  }, [navigate]);

  if (checkingSession && !autoCitizen) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
        style={{
          background:
            "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 55%, #312e81 100%)",
        }}
      >
        <div className="flex flex-col items-center gap-3 text-white">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-lg">
            <Shield className="h-6 w-6 text-blue-300" />
          </div>
          <div className="flex items-center gap-2 text-sm text-blue-200">
            <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
            <span>Checking secure session...</span>
          </div>
        </div>
      </div>
    );
  }

  if (autoCitizen) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
        style={{
          background:
            "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 55%, #312e81 100%)",
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
            <CheckCircle className="h-8 w-8" />
          </div>
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
              Verified Citizen Session
            </span>
            <h2 className="text-xl font-bold text-gray-900">Welcome Back</h2>
            <p className="text-base font-semibold text-blue-700 mt-1">
              {autoCitizen.name}
            </p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              +91 {autoCitizen.phone} · {maskEmail(autoCitizen.email)}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-1">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>Opening citizen portal automatically…</span>
          </div>

          <button
            onClick={() => navigate("/home", { replace: true })}
            className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
          >
            <span>Continue to Portal Now</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={() => {
              setAutoCitizen(null);
              setCheckingSession(false);
              sessionStorage.setItem("citizen_explicit_logout", "true");
              localStorage.removeItem("citizen_user");
              sessionStorage.removeItem("citizen_user");
            }}
            className="text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer block w-full text-center pt-1"
          >
            Sign in with a different mobile number
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{
        background:
          "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 55%, #312e81 100%)",
      }}
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-5 text-white backdrop-blur-sm">
          <Shield className="h-4 w-4 text-blue-300" />
          Tamil Nadu Police · REPORT System
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">
          Citizen Portal
        </h1>
        <p className="text-blue-200 text-sm mt-1">
          Verify your identity to file a complaint
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-5">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                s === step ? "w-8 bg-blue-600" : s < step ? "w-4 bg-green-500" : "w-4 bg-gray-200"
              }`}
            />
          ))}
        </div>

        <h2 className="text-lg font-bold text-gray-900 text-center mb-1">
          {step === 1 ? "Your Details" : "Verify OTP"}
        </h2>

        {step === 1 ? (
          <DetailsStep
            onNext={(data) => {
              citizenRef.current = data;
              setStep(2);
            }}
          />
        ) : (
          <OTPStep
            citizen={citizenRef.current}
            onVerified={() => navigate("/home")}
            onBack={() => setStep(1)}
          />
        )}

        <div className="border-t border-gray-100 pt-3 mt-4">
          <p className="text-xs text-gray-400 text-center">
            Your information is secure · Used only for FIR verification
          </p>
        </div>
      </div>
    </div>
  );
}