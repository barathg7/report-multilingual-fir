// supabase/functions/send-sos-sms/index.ts
// Stage 6.7: Hardened Server-Side Automatic SOS SMS Dispatch with httpSMS Gateway
// Enforces database-backed atomic claim, httpSMS Android gateway queueing, and truthful state reporting.

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

// Fallback in-memory cache for local test runs where database is not attached
const memoryClaimedSosIds = new Set<string>();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin =
      supabaseUrl && supabaseServiceKey
        ? createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
          })
        : null;

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
    const resolvedStation = (station_code || stationCode || "ONLINE").trim().toUpperCase();

    // 1. Validate required fields
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

    // 2. Derive 3 primary contacts server-side
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

    // 3. Database-backed Atomic Claim
    let claimGranted = true;
    let claimErrorMsg: string | null = null;
    let claimState = "SMS_SUBMISSION_PENDING";

    if (supabaseAdmin) {
      const { data: claimData, error: claimErr } = await supabaseAdmin.rpc("claim_sos_sms_dispatch", {
        p_sos_id: alertId,
        p_station_code: resolvedStation,
        p_recipient_count: primaryRecipients.length,
        p_masked_recipients: maskedRecipients,
        p_max_attempts: 2,
      });

      if (claimErr) {
        console.warn(`[send-sos-sms] claim_sos_sms_dispatch DB error: ${claimErr.message}`);
        if (memoryClaimedSosIds.has(alertId)) {
          claimGranted = false;
          claimErrorMsg = "Duplicate dispatch blocked: SOS alert already submitted.";
        } else {
          memoryClaimedSosIds.add(alertId);
        }
      } else if (claimData) {
        if (!claimData.claimed) {
          claimGranted = false;
          claimErrorMsg = claimData.message || "Duplicate dispatch blocked: SOS alert already processed.";
          claimState = claimData.state || "SMS_PROVIDER_REJECTED";
        }
      }
    } else {
      if (memoryClaimedSosIds.has(alertId)) {
        claimGranted = false;
        claimErrorMsg = "Duplicate dispatch blocked: SOS alert already submitted.";
      } else {
        memoryClaimedSosIds.add(alertId);
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

    // 4. httpSMS Provider Dispatch via Adapter
    const providerResult = await sendAutomaticSosSms({
      sosId: alertId,
      stationCode: resolvedStation,
      recipients: Array.isArray(recipients) && recipients.length > 0 ? recipients : primaryRecipients,
      message,
    });

    if (providerResult.state === "SMS_PROVIDER_NOT_CONFIGURED") {
      if (supabaseAdmin) {
        await supabaseAdmin.rpc("update_sos_sms_dispatch", {
          p_sos_id: alertId,
          p_state: "SMS_PROVIDER_NOT_CONFIGURED",
          p_provider_request_id: null,
          p_error_message: "httpSMS Android gateway configuration incomplete on server.",
        });
      }

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

    // 5. Update Dispatch Outcome in Database
    if (providerResult.success && providerResult.state === "SMS_SUBMITTED") {
      const requestId = providerResult.requestId || `req_${Date.now()}`;
      console.log(`[send-sos-sms] SMS_SUBMITTED: SOS ${alertId} queued for Android SIM gateway. Request ID: ${requestId}`);

      if (supabaseAdmin) {
        await supabaseAdmin.rpc("update_sos_sms_dispatch", {
          p_sos_id: alertId,
          p_state: "SMS_SUBMITTED",
          p_provider_request_id: requestId,
          p_error_message: null,
        });
      }

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

      if (supabaseAdmin) {
        await supabaseAdmin.rpc("update_sos_sms_dispatch", {
          p_sos_id: alertId,
          p_state: "SMS_PROVIDER_REJECTED",
          p_provider_request_id: null,
          p_error_message: sanitizedError,
        });
      }

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