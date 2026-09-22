// supabase/functions/send-sos-sms/index.ts
// Stage 6.7: Hardened Server-Side Automatic SOS SMS Dispatch with httpSMS Gateway
// Enforces caller authentication, database-backed atomic claim, httpSMS Android gateway queueing, and truthful state reporting.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  AUTHORIZED_SOS_RECIPIENTS,
  getStationPrimaryRecipients,
  maskPhoneNumber,
  sendAutomaticSosSms,
} from "../_shared/smsProvider.ts";

export { AUTHORIZED_SOS_RECIPIENTS, getStationPrimaryRecipients };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    // Only use the server-configured Supabase public/publishable/anon key from environment.
    // Never allow a caller-supplied apikey header to become the Supabase client credential.
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    // Server-only service role key strictly for privileged dispatch outcome updates (never used for citizen auth)
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // 1. Fail closed: Missing server configuration aborts immediately.
    // Citizen authentication must never be bypassed or skipped if a server key is missing.
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("[send-sos-sms] Server configuration error: Missing SUPABASE_URL, server-side Supabase public key, or service key");
      return new Response(
        JSON.stringify({
          success: false,
          state: "SMS_PROVIDER_REJECTED",
          error: "Server configuration error: Database connection keys are unavailable. Authentication cannot be verified.",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 2. Enforce citizen authentication strictly using session JWT
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          success: false,
          state: "SMS_PROVIDER_REJECTED",
          error: "Unauthorized: Valid citizen authentication is required to dispatch emergency SOS SMS.",
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Citizen client: strictly uses server-configured supabaseAnonKey + citizen Bearer token
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
      auth: { persistSession: false },
    });

    // Server admin client: strictly used for service_role dispatch outcome updates after gateway call
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          state: "SMS_PROVIDER_REJECTED",
          error: "Unauthorized: Valid citizen authentication is required to dispatch emergency SOS SMS.",
        }),
        { status: 401, headers: corsHeaders }
      );
    }
    const authenticatedUser = user;

    const body = await req.json().catch(() => ({}));
    const {
      sos_id,
      sosId,
      station_code,
      stationCode,
      message,
      to,
      recipients,
    } = body;

    const alertId = (sos_id || sosId || "").trim();
    let resolvedStation = (station_code || stationCode || "ONLINE").trim().toUpperCase();

    // 3. Validate required fields
    if (!alertId) {
      return new Response(
        JSON.stringify({
          success: false,
          state: "SMS_PROVIDER_REJECTED",
          error: "SOS record ID (sos_id) is required for automated SMS dispatch.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          state: "SMS_PROVIDER_REJECTED",
          error: "SOS canonical message cannot be empty.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 4. Application-level Authorization & Database Record Verification
    // Step A: Verify that the SOS alert actually exists in sos_records
    // RLS ensures callers can only select SOS records they own (user_id = auth.uid())
    const { data: verifiedSos, error: sosFetchError } = await supabaseClient
      .from("sos_records")
      .select("id, status, nearest_station_code, created_at, user_id")
      .eq("id", alertId)
      .maybeSingle();

    if (sosFetchError || !verifiedSos) {
      console.warn(`[send-sos-sms] Unauthorized dispatch attempt: SOS ${alertId} not found in database or not owned by caller ${authenticatedUser.id}.`, sosFetchError);
      return new Response(
        JSON.stringify({
          success: false,
          state: "SMS_PROVIDER_REJECTED",
          error: `Unauthorized dispatch: Verified SOS record '${alertId}' not found in database. Fabricated requests are blocked.`,
          sos_id: alertId,
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Step B: Verify that the SOS alert is currently active
    if (verifiedSos.status !== "active") {
      return new Response(
        JSON.stringify({
          success: false,
          state: "SMS_PROVIDER_REJECTED",
          error: `Invalid SOS status: Alert '${alertId}' is ${verifiedSos.status}. Only active alerts can trigger SMS dispatch.`,
          sos_id: alertId,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Step C: Verify that the alert was created recently (within 15 minutes) to block replay attacks
    const createdAtMs = new Date(verifiedSos.created_at).getTime();
    if (Number.isFinite(createdAtMs) && Date.now() - createdAtMs > 15 * 60 * 1000) {
      return new Response(
        JSON.stringify({
          success: false,
          state: "SMS_PROVIDER_REJECTED",
          error: `Expired SOS alert: Record '${alertId}' was created over 15 minutes ago. Replay dispatch blocked.`,
          sos_id: alertId,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Step D: Server-side derive jurisdiction strictly from verified database record
    resolvedStation = (verifiedSos.nearest_station_code || "ONLINE").trim().toUpperCase();

    // 5. Derive 3 primary contacts strictly server-side based on verified station jurisdiction
    const primaryRecipients = getStationPrimaryRecipients(resolvedStation);
    const maskedRecipients = primaryRecipients.map(maskPhoneNumber);

    // Reject arbitrary client-supplied recipients
    if (to && !AUTHORIZED_SOS_RECIPIENTS.includes(to as any)) {
      return new Response(
        JSON.stringify({
          success: false,
          state: "SMS_PROVIDER_REJECTED",
          error: `Unauthorized recipient: ${to}. Only server-derived authorized SOS numbers are permitted.`,
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (Array.isArray(recipients)) {
      for (const r of recipients) {
        if (!AUTHORIZED_SOS_RECIPIENTS.includes(r as any)) {
          return new Response(
            JSON.stringify({
              success: false,
              state: "SMS_PROVIDER_REJECTED",
              error: `Unauthorized recipient in list: ${r}. Arbitrary phone injection is blocked.`,
            }),
            { status: 403, headers: corsHeaders }
          );
        }
      }
    }

    // 6. Database-backed Atomic Claim (SECURITY DEFINER RPC with ownership verification)
    const { data: claimData, error: claimErr } = await supabaseClient.rpc("claim_sos_sms_dispatch", {
      p_sos_id: alertId,
      p_station_code: resolvedStation,
      p_recipient_count: primaryRecipients.length,
      p_masked_recipients: maskedRecipients,
      p_max_attempts: 2,
    });

    let claimGranted = true;
    let claimErrorMsg: string | null = null;
    let claimState = "SMS_SUBMISSION_PENDING";

    if (claimErr) {
      console.warn(`[send-sos-sms] claim_sos_sms_dispatch DB error: ${claimErr.message}`);
      claimGranted = false;
      claimErrorMsg = `SMS dispatch claim failed: ${claimErr.message}`;
      claimState = "SMS_PROVIDER_REJECTED";
    } else if (claimData) {
      if (!claimData.claimed) {
        claimGranted = false;
        claimErrorMsg = claimData.message || claimData.error || "Duplicate dispatch blocked: SOS alert already processed.";
        claimState = claimData.state || "SMS_PROVIDER_REJECTED";
      }
    }

    if (!claimGranted) {
      return new Response(
        JSON.stringify({
          success: false,
          state: claimState,
          error: claimErrorMsg,
          sos_id: alertId,
        }),
        { status: 409, headers: corsHeaders }
      );
    }

    // 7. httpSMS Provider Dispatch via Adapter
    // Recipients are strictly server-controlled primaryRecipients
    const providerResult = await sendAutomaticSosSms({
      sosId: alertId,
      stationCode: resolvedStation,
      recipients: primaryRecipients,
      message,
    });

    if (providerResult.state === "SMS_PROVIDER_NOT_CONFIGURED") {
      await supabaseAdmin.rpc("update_sos_sms_dispatch", {
        p_sos_id: alertId,
        p_state: "SMS_PROVIDER_NOT_CONFIGURED",
        p_provider_request_id: null,
        p_error_message: "httpSMS Android gateway configuration incomplete on server.",
      });

      return new Response(
        JSON.stringify({
          success: false,
          state: "SMS_PROVIDER_NOT_CONFIGURED",
          error: providerResult.error,
          sos_id: alertId,
          recipient_count: primaryRecipients.length,
          masked_recipients: maskedRecipients,
        }),
        { status: 503, headers: corsHeaders }
      );
    }

    // 8. Update Dispatch Outcome in Database (via trusted server-side service_role)
    if (providerResult.success && providerResult.state === "SMS_SUBMITTED") {
      const requestId = providerResult.requestId || `req_${Date.now()}`;
      console.log(`[send-sos-sms] SMS_SUBMITTED: SOS ${alertId} queued for Android SIM gateway. Request ID: ${requestId}`);

      await supabaseAdmin.rpc("update_sos_sms_dispatch", {
        p_sos_id: alertId,
        p_state: "SMS_SUBMITTED",
        p_provider_request_id: requestId,
        p_error_message: null,
      });

      return new Response(
        JSON.stringify({
          success: true,
          state: "SMS_SUBMITTED",
          message: "SOS SMS submitted to 3 emergency contacts.",
          request_id: requestId,
          message_ids: providerResult.messageIds,
          sos_id: alertId,
          station_code: resolvedStation,
          recipient_count: primaryRecipients.length,
          masked_recipients: maskedRecipients,
          timestamp: new Date().toISOString(),
          provider: "httpSMS",
          gateway_note: "Queued on httpSMS Android gateway for physical SIM transmission. Delivery pending gateway report.",
        }),
        { status: 200, headers: corsHeaders }
      );
    } else {
      const sanitizedError = providerResult.error || "httpSMS gateway rejected submission";
      console.warn(`[send-sos-sms] SMS_PROVIDER_REJECTED: SOS ${alertId}: ${sanitizedError}`);

      await supabaseAdmin.rpc("update_sos_sms_dispatch", {
        p_sos_id: alertId,
        p_state: "SMS_PROVIDER_REJECTED",
        p_provider_request_id: null,
        p_error_message: sanitizedError,
      });

      return new Response(
        JSON.stringify({
          success: false,
          state: "SMS_PROVIDER_REJECTED",
          error: sanitizedError,
          sos_id: alertId,
          recipient_count: primaryRecipients.length,
          masked_recipients: maskedRecipients,
          provider: "httpSMS",
        }),
        { status: 502, headers: corsHeaders }
      );
    }
  } catch (err: any) {
    console.error("[send-sos-sms] Server error:", err?.message);
    return new Response(
      JSON.stringify({
        success: false,
        state: "SMS_PROVIDER_REJECTED",
        error: err?.message || "Internal server error during SMS dispatch",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});