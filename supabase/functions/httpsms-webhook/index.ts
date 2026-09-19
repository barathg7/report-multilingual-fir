// supabase/functions/httpsms-webhook/index.ts
// Stage 6.7.1: Hardened httpSMS Gateway Delivery Webhook Callback Handler
// Validates official HS256 JWT signatures, CloudEvents schema, and correlates strictly via provider message ID.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-event-type",
  "Content-Type": "application/json",
};

export interface JwtVerificationResult {
  valid: boolean;
  reason?: string;
  payload?: any;
}

/**
 * Validates HS256 JWT signature and claims using Web Crypto API.
 * The official httpSMS webhook sends Authorization: Bearer <jwt> signed with the webhook signing key.
 */
export async function verifyHttpSmsSignature(
  token: string,
  secret: string
): Promise<JwtVerificationResult> {
  try {
    if (!token || !secret) {
      return { valid: false, reason: "Missing token or secret" };
    }
    const parts = token.trim().split(".");
    if (parts.length !== 3) {
      return { valid: false, reason: "Malformed JWT token structure" };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    const b64UrlDecode = (str: string) => {
      const standard = str.replace(/-/g, "+").replace(/_/g, "/");
      const padded = standard + "=".repeat((4 - (standard.length % 4)) % 4);
      return atob(padded);
    };

    // 1. Validate Header
    let header: any;
    try {
      header = JSON.parse(b64UrlDecode(headerB64));
    } catch {
      return { valid: false, reason: "Malformed JWT header" };
    }

    if (header.alg !== "HS256") {
      return { valid: false, reason: `Unsupported algorithm: ${header.alg} (expected HS256)` };
    }

    // 2. Validate Payload & Claims
    let payload: any;
    try {
      payload = JSON.parse(b64UrlDecode(payloadB64));
    } catch {
      return { valid: false, reason: "Malformed JWT payload" };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && typeof payload.exp === "number" && nowSec > payload.exp) {
      return { valid: false, reason: "Token expired" };
    }
    if (payload.nbf && typeof payload.nbf === "number" && nowSec < payload.nbf) {
      return { valid: false, reason: "Token not yet valid (nbf claim)" };
    }

    // 3. Verify HMAC-SHA256 Signature
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sigBytes = Uint8Array.from(b64UrlDecode(signatureB64), (c) => c.charCodeAt(0));
    const isSigValid = await crypto.subtle.verify("HMAC", key, sigBytes, data);

    if (!isSigValid) {
      return { valid: false, reason: "Invalid token signature" };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, reason: err?.message || "Token verification exception" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // 1. Verify Content-Type Header
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return new Response(
        JSON.stringify({ error: "Unsupported Media Type: Expected application/json" }),
        { status: 415, headers: corsHeaders }
      );
    }

    // 2. Verify Webhook Signing Key Configuration
    const webhookSigningKey = Deno.env.get("HTTPSMS_WEBHOOK_SIGNING_KEY")?.trim();
    if (!webhookSigningKey) {
      console.error("[httpsms-webhook] Server configuration error: HTTPSMS_WEBHOOK_SIGNING_KEY missing");
      return new Response(
        JSON.stringify({ error: "Server configuration error: Webhook signing key not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 3. Verify Authorization Header (Bearer JWT)
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Bearer token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const verification = await verifyHttpSmsSignature(token, webhookSigningKey);
    if (!verification.valid) {
      return new Response(
        JSON.stringify({ error: `Unauthorized: ${verification.reason}` }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 4. Parse & Validate CloudEvents JSON Payload
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return new Response(
        JSON.stringify({ error: "Bad Request: Malformed JSON payload" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const headerEventType = req.headers.get("x-event-type")?.trim();
    const bodyEventType = typeof body.type === "string" ? body.type.trim() : "";
    const eventType = bodyEventType || headerEventType || "";

    if (!eventType) {
      return new Response(
        JSON.stringify({ error: "Bad Request: Missing event type in request" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (headerEventType && bodyEventType && headerEventType !== bodyEventType) {
      return new Response(
        JSON.stringify({ error: "Bad Request: Mismatched X-Event-Type header and body type" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const ALL_SUPPORTED_EVENTS = [
      "message.phone.sent",
      "message.phone.delivered",
      "message.send.failed",
      "message.send.expired",
      "message.phone.received",
      "message.call.missed",
      "phone.heartbeat.offline",
      "phone.heartbeat.online",
    ];

    if (!ALL_SUPPORTED_EVENTS.includes(eventType)) {
      return new Response(
        JSON.stringify({ error: `Bad Request: Unknown event type '${eventType}'` }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Informational / Non-outbound SMS events
    if (
      eventType === "message.phone.received" ||
      eventType === "message.call.missed" ||
      eventType === "phone.heartbeat.offline" ||
      eventType === "phone.heartbeat.online"
    ) {
      return new Response(
        JSON.stringify({ received: true, ignored: true, event: eventType }),
        { status: 200, headers: corsHeaders }
      );
    }

    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
      return new Response(
        JSON.stringify({ error: "Bad Request: Malformed CloudEvents data payload" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const eventData = body.data;
    // In official httpSMS:
    // message.phone.delivered, message.phone.sent, message.send.failed provide `data.id`
    // message.send.expired provides `data.message_id`
    const providerMessageId = (eventData.id || eventData.message_id || "").trim();

    if (!providerMessageId) {
      return new Response(
        JSON.stringify({ error: "Bad Request: Missing provider message identifier in event data" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 5. Map Event to State Machine
    let targetState: string | null = null;
    let errorMessage: string | null = null;

    if (eventType === "message.phone.delivered") {
      targetState = "SMS_DELIVERY_CONFIRMED";
    } else if (eventType === "message.send.failed" || eventType === "message.send.expired") {
      targetState = "SMS_DELIVERY_FAILED";
      errorMessage = eventData.error_message || eventData.error || `SMS send failed on Android gateway (${eventType})`;
    } else if (eventType === "message.phone.sent") {
      targetState = "SMS_SUBMITTED";
    }

    // 6. Update Database Atomically via Provider Message ID Correlation
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      const { data, error } = await supabaseAdmin.rpc("update_sos_sms_delivery_status", {
        p_identifier: providerMessageId,
        p_state: targetState,
        p_provider_request_id: providerMessageId,
        p_error_message: errorMessage,
      });

      if (error) {
        console.error("[httpsms-webhook] DB error updating delivery status:", error.message);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      if (data && data.success === false) {
        console.warn(`[httpsms-webhook] Correlation failed for provider message ID ${providerMessageId}: ${data.error}`);
        return new Response(
          JSON.stringify({ error: data.error || "Dispatch record not found" }),
          { status: 404, headers: corsHeaders }
        );
      }

      console.log(`[httpsms-webhook] Correlated provider message ${providerMessageId} -> state: ${targetState}`);
      return new Response(
        JSON.stringify({ received: true, state: targetState, provider_message_id: providerMessageId, data }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        received: true,
        state: targetState,
        db_skipped: true,
        provider_message_id: providerMessageId,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[httpsms-webhook] Server error:", err?.message);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
