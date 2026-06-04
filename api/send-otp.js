// api/send-otp.js — Vercel Serverless Function
// Uses Resend with PROPER error handling
// For Gmail: set GMAIL_USER + GMAIL_APP_PASSWORD in Vercel env vars
// Gmail App Password: myaccount.google.com/apppasswords → create one → paste here

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== "object") {
    body = await new Promise((resolve) => {
      let raw = "";
      req.on("data", (c) => { raw += c.toString(); });
      req.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    });
  }

  const { name, mobile, email, otp } = body;
  if (!name || !mobile || !email || !otp) {
    return res.status(400).json({ success: false, message: "name, mobile, email and otp are required" });
  }

  const cleanMobile = String(mobile).replace(/\D/g, "").slice(-10);

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#f8fafc;border-radius:16px;border:1px solid #e2e8f0;">
      <div style="text-align:center;margin-bottom:20px;">
        <h1 style="margin:0;color:#1d4ed8;font-size:24px;">REPORT</h1>
        <p style="margin:6px 0 0;color:#64748b;font-size:13px;">Tamil Nadu Police · FIR System</p>
      </div>
      <h2 style="margin:0 0 8px;text-align:center;color:#0f172a;">Verify your identity</h2>
      <p style="margin:0 0 18px;text-align:center;color:#475569;font-size:14px;">Hello ${name}, use the OTP below to continue.</p>
      <div style="background:#fff;border:2px dashed #3b82f6;border-radius:12px;padding:20px;text-align:center;margin-bottom:18px;">
        <div style="font-size:36px;font-weight:800;letter-spacing:10px;color:#1d4ed8;">${otp}</div>
      </div>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px;margin-bottom:16px;">
        <p style="margin:0;color:#1e40af;font-size:13px;">Mobile: <strong>+91 ${cleanMobile}</strong></p>
      </div>
      <p style="margin:0;text-align:center;color:#64748b;font-size:12px;">Valid for 10 minutes. Do not share with anyone.</p>
    </div>`;

  // ── Option 1: Gmail via SMTP2GO (no nodemailer needed, pure fetch) ─────────
  const SMTP2GO_KEY = process.env.SMTP2GO_API_KEY;
  if (SMTP2GO_KEY) {
    try {
      const r = await fetch("https://api.smtp2go.com/v3/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: SMTP2GO_KEY,
          to: [`${name} <${email}>`],
          sender: "REPORT FIR System <noreply@report-fir.com>",
          subject: `${otp} — Your OTP for REPORT FIR System`,
          html_body: htmlBody,
        }),
      });
      const d = await r.json();
      if (d.data?.succeeded === 1) {
        return res.status(200).json({ success: true, devMode: false, message: "OTP sent via SMTP2GO" });
      }
      console.warn("SMTP2GO failed:", d);
    } catch (e) { console.warn("SMTP2GO error:", e.message); }
  }

  // ── Option 2: Resend (works if email is verified in Resend dashboard) ──────
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (RESEND_KEY) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "REPORT System <onboarding@resend.dev>",
          to: [email],
          subject: `${otp} — Your OTP for REPORT FIR System`,
          html: htmlBody,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && !d.error) {
        return res.status(200).json({ success: true, devMode: false, message: "OTP sent via Resend" });
      }
      const msg = d.message || d.error?.message || "";
      const isSandbox = msg.includes("only send testing emails") || msg.includes("verify a domain");
      if (isSandbox) {
        // Resend sandbox — show OTP on screen
        return res.status(200).json({
          success: true,
          devMode: true,
          devOtp: String(otp),
          devMessage: "To send OTP to any email: Add SMTP2GO_API_KEY to Vercel env vars (free at smtp2go.com — 1000 emails/month). OTP shown here for now.",
        });
      }
      console.warn("Resend error:", msg);
    } catch (e) { console.warn("Resend error:", e.message); }
  }

  // ── Fallback: Show OTP on screen ───────────────────────────────────────────
  return res.status(200).json({
    success: true,
    devMode: true,
    devOtp: String(otp),
    devMessage: "Email provider not configured. Sign up at smtp2go.com (free) → get API key → add SMTP2GO_API_KEY to Vercel Environment Variables.",
  });
}