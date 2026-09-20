// supabase/functions/_shared/smsProvider.ts
// Stage 6.7: httpSMS Server-Side Gateway Adapter for REPORT SOS
// Integrates with official NdoleStudio/httpSMS API contract:
// client -> POST /v1/messages/send -> 202 Accepted -> Android App -> SIM -> Carrier delivery.

export const AUTHORIZED_SOS_RECIPIENTS = [
  "+918428077014",
  "+916382586270",
  "+918122319636",
  "+919487304237",
  "+919047461987",
  "+916374763637",
] as const;

/**
 * Validates whether a phone number belongs to the authorized recipient whitelist.
 */
export function isAuthorizedRecipient(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  return (AUTHORIZED_SOS_RECIPIENTS as readonly string[]).includes(phone.trim());
}

/**
 * Normalizes phone numbers to standard E.164 format (+91 followed by 10 digits).
 */
export function normalizeE164(phone: string): string | null {
  if (!phone || typeof phone !== "string") return null;
  const cleaned = phone.trim().replace(/[\s-()]/g, "");
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  return null;
}

/**
 * Masks phone numbers to protect citizen and contact privacy in logs and UI.
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== "string") return "";
  const trimmed = phone.trim();
  if (trimmed.startsWith("+91") && trimmed.length === 13) {
    return `+91 ••••••${trimmed.slice(-4)}`;
  }
  if (trimmed.length > 4) {
    const last4 = trimmed.slice(-4);
    const prefix = trimmed.startsWith("+") ? trimmed.slice(0, 3) + " " : "";
    return `${prefix}••••••${last4}`;
  }
  return "••••";
}

/**
 * 32-bit FNV-1a hash algorithm matching client-side implementation.
 */
export function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Mulberry32 PRNG for deterministic permutation generation.
 */
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derives the 3 primary contacts deterministically from the station code.
 */
export function getStationPrimaryRecipients(stationCode: string): string[] {
  const normalizedCode = (stationCode || "DEFAULT").trim().toUpperCase();
  const seedString = `${normalizedCode}:${AUTHORIZED_SOS_RECIPIENTS.join(",")}`;
  const seed = hashString(seedString);
  const prng = mulberry32(seed);

  const shuffled = [...AUTHORIZED_SOS_RECIPIENTS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 3);
}

/**
 * Sanitizes error messages to strictly prevent token or secret leakage.
 */
export function sanitizeError(raw: any): string {
  if (!raw) return "Unknown provider error";
  const str = typeof raw === "string" ? raw : JSON.stringify(raw);
  return str.replace(/[a-zA-Z0-9_-]{24,}/g, "[REDACTED]");
}

export interface SendAutomaticSosParams {
  sosId: string;
  stationCode: string;
  recipients?: string[];
  message: string;
}

export interface ProviderSendResult {
  success: boolean;
  state: "SMS_SUBMITTED" | "SMS_PROVIDER_REJECTED" | "SMS_PROVIDER_NOT_CONFIGURED";
  messageIds?: string[];
  requestId?: string;
  error?: string;
  maskedRecipients?: string[];
  recipientCount?: number;
  provider?: string;
  httpStatus?: number;
}

/**
 * Dispatches an automatic SOS SMS alert via the official httpSMS API.
 * Returns state SMS_SUBMITTED upon HTTP 202 Accepted.
 * NEVER returns SMS_DELIVERY_CONFIRMED until actual carrier delivery callback arrives.
 */
export async function sendAutomaticSosSms(params: SendAutomaticSosParams): Promise<ProviderSendResult> {
  const sosId = (params.sosId || "").trim();
  const stationCode = (params.stationCode || "ONLINE").trim().toUpperCase();
  const message = (params.message || "").trim();

  // 1. Validation
  if (!sosId) {
    return {
      success: false,
      state: "SMS_PROVIDER_REJECTED",
      error: "SOS ID (sosId) is required for automated SMS dispatch.",
    };
  }

  if (!message) {
    return {
      success: false,
      state: "SMS_PROVIDER_REJECTED",
      error: "SOS message cannot be empty.",
    };
  }

  // 2. Validate or derive the 3 primary contacts
  let targetRecipients: string[] = [];
  if (Array.isArray(params.recipients) && params.recipients.length > 0) {
    // Validate each client-supplied number against authorized whitelist
    for (const r of params.recipients) {
      if (!isAuthorizedRecipient(r)) {
        return {
          success: false,
          state: "SMS_PROVIDER_REJECTED",
          error: `Unauthorized recipient: ${r}. Arbitrary phone injection is blocked.`,
        };
      }
    }
    targetRecipients = params.recipients.slice(0, 3);
  } else {
    targetRecipients = getStationPrimaryRecipients(stationCode);
  }

  const maskedRecipients = targetRecipients.map(maskPhoneNumber);

  // 3. Provider Configuration Gate
  const apiKey = Deno.env.get("HTTPSMS_API_KEY")?.trim()?.replace(/^["']|["']$/g, "") || null;
  const fromNumber = Deno.env.get("HTTPSMS_FROM_NUMBER")?.trim()?.replace(/^["']|["']$/g, "") || null;
  const baseUrl = Deno.env.get("HTTPSMS_BASE_URL")?.trim()?.replace(/\/+$/, "") || "https://api.httpsms.com";

  if (!apiKey || !fromNumber) {
    const missing = [
      !apiKey && "HTTPSMS_API_KEY",
      !fromNumber && "HTTPSMS_FROM_NUMBER",
    ].filter(Boolean).join(", ");

    const errorMsg = `httpSMS gateway configuration incomplete (missing: ${missing}).`;
    console.warn(`[smsProvider] SMS_PROVIDER_NOT_CONFIGURED for SOS ${sosId}: ${errorMsg}`);

    return {
      success: false,
      state: "SMS_PROVIDER_NOT_CONFIGURED",
      error: errorMsg,
      maskedRecipients,
      recipientCount: targetRecipients.length,
      provider: "httpSMS",
    };
  }

  // 4. Dispatch to official httpSMS API: POST /v1/messages/send
  // Returns HTTP 202 Accepted for queued messages
  const sendEndpoint = `${baseUrl}/v1/messages/send`;
  const collectedMessageIds: string[] = [];
  const errors: string[] = [];

  for (let idx = 0; idx < targetRecipients.length; idx++) {
    const recipient = targetRecipients[idx];
    const payload = {
      from: fromNumber,
      to: recipient,
      content: message,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      let res: Response;
      try {
        res = await fetch(sendEndpoint, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await res.json().catch(() => ({}));

      // httpSMS returns 202 Accepted (or 200 OK) when queued for Android gateway
      if (res.status === 202 || res.status === 200 || data?.status === "success") {
        const msgId = data?.data?.id || data?.id;
        if (msgId && typeof msgId === "string" && msgId.trim()) {
          collectedMessageIds.push(msgId.trim());
        } else {
          errors.push(`Recipient ${maskPhoneNumber(recipient)}: Provider accepted but returned no message identifier (missing data.id)`);
        }
      } else if (res.status >= 400 && res.status < 500) {
        const errMsg = data?.message || `HTTP ${res.status}`;
        errors.push(`Recipient ${maskPhoneNumber(recipient)} rejected (HTTP ${res.status}): ${errMsg}`);
      } else {
        const errMsg = data?.message || `HTTP ${res.status}`;
        errors.push(`Recipient ${maskPhoneNumber(recipient)} provider failure (HTTP ${res.status}): ${errMsg}`);
      }
    } catch (fetchErr: any) {
      if (fetchErr?.name === "AbortError") {
        errors.push(`Recipient ${maskPhoneNumber(recipient)} network timeout connecting to provider`);
      } else {
        errors.push(`Recipient ${maskPhoneNumber(recipient)} network error: ${fetchErr?.message || "Unknown error"}`);
      }
    }
  }

  // 5. Evaluate outcome
  if (collectedMessageIds.length > 0) {
    const combinedId = collectedMessageIds.join(",");
    console.log(`[smsProvider] SMS_SUBMITTED: SOS ${sosId} queued for Android gateway. Message IDs: ${combinedId}`);
    return {
      success: true,
      state: "SMS_SUBMITTED",
      messageIds: collectedMessageIds,
      requestId: combinedId,
      maskedRecipients,
      recipientCount: targetRecipients.length,
      provider: "httpSMS",
      httpStatus: 202,
    };
  }

  const sanitized = sanitizeError(errors.join("; ") || "httpSMS gateway rejected submission.");
  console.warn(`[smsProvider] SMS_PROVIDER_REJECTED: SOS ${sosId}: ${sanitized}`);

  return {
    success: false,
    state: "SMS_PROVIDER_REJECTED",
    error: sanitized,
    maskedRecipients,
    recipientCount: targetRecipients.length,
    provider: "httpSMS",
  };
}
