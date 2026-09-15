import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Fixed whitelist of authorized SOS recipients for demo/testing environment
export const AUTHORIZED_SOS_RECIPIENTS = [
  "+918428077014",
  "+916382586270",
  "+918122319636",
  "+919487304237",
  "+919047461987",
  "+916374763637",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const AUTH_TOKEN  = Deno.env.get("TWILIO_AUTH_TOKEN");
    const FROM_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Twilio secrets on server" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { to, message } = body;

    // Security Gate: Disallow arbitrary SMS dispatch; only allow whitelisted numbers
    if (!to || !AUTHORIZED_SOS_RECIPIENTS.includes(to as any)) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized recipient: SOS dispatch is restricted to authorized emergency contacts." }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "SOS message body cannot be empty" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const auth = btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: FROM_NUMBER, Body: message }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const safeMsg = data?.message || `Provider dispatch error (${res.status})`;
      return new Response(
        JSON.stringify({ success: false, error: safeMsg }),
        { status: res.status >= 400 && res.status < 500 ? res.status : 502, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true, sid: data.sid }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});