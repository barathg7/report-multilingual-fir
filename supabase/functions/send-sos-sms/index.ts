import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const AUTH_TOKEN  = Deno.env.get("TWILIO_AUTH_TOKEN");
    const FROM_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
      return new Response(JSON.stringify({ error: "Missing Twilio secrets" }), { status: 500, headers: corsHeaders });
    }

    const { to, message } = await req.json();
    const auth = btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: FROM_NUMBER, Body: message }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Twilio error");

    return new Response(JSON.stringify({ success: true, sid: data.sid }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});