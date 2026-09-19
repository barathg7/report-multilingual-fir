# httpSMS Android Gateway Setup & Operations Guide

This document describes how to configure, operate, and maintain the **httpSMS Android Gateway** as the automated SMS transport for the REPORT Emergency SOS system.

---

## 1. Architectural Role & Overview

In REPORT Stage 6.7, httpSMS replaces third-party carrier aggregators with a dedicated **Android device gateway**:

```
Citizen Emergency Alert
  ↓
EmergencySecurity Terminal
  ↓
Supabase Database (sos_records)
  ↓
Police Realtime Alert (Instant WebSocket to Station Dashboard)
  ↓ (simultaneous server dispatch)
Supabase Edge Function (send-sos-sms)
  ↓
httpSMS Cloud API (https://api.httpsms.com/v1/messages/send) [HTTP 202 Accepted]
  ↓
httpSMS Android Application (via internet connection)
  ↓
Android OS SMS Manager & SIM Card
  ↓
Cellular Telecom Carrier Network
  ↓
3 Primary Authorized Emergency Contacts
  ↓
Carrier Delivery Report (PDU)
  ↓
httpSMS Android Application
  ↓
httpSMS Webhook (POST /functions/v1/httpsms-webhook)
  ↓
REPORT Database State: SMS_DELIVERY_CONFIRMED
```

### Critical Operational Truths
1. **This is not browser-native SMS**: Citizens do not manually draft or click "Send" on their phone's SMS app. The transmission is triggered automatically by the server.
2. **The Android Gateway Phone is REQUIRED for physical delivery**: The httpSMS cloud API returns **HTTP 202 Accepted** when the message enters the outgoing queue. Actual transmission over cellular towers occurs when the Android phone receives the dispatch instructions and triggers its hardware SIM card.
3. **HTTP 202 != Delivered**: A successful API call only confirms that httpSMS accepted the message (`SMS_SUBMITTED`). Delivery is only confirmed when the cellular carrier returns a delivery report (`SMS_DELIVERY_CONFIRMED`).
4. **Police Realtime Alerts are Independent**: The jurisdictional police command post receives the SOS alert instantly over Supabase Realtime WebSocket, regardless of whether the SMS gateway phone is online, out of balance, or delayed.
5. **No Guaranteed Availability**: Like all cellular SMS, delivery depends on local cell tower congestion, carrier routing, and device power. Direct calls to **112** remain the primary civic emergency channel.
6. **Strict Official API & Webhook Contract**:
   - Outbound `POST /v1/messages/send` payload contains **only** documented fields: `{ from, to, content }`.
   - Authentication header: `x-api-key: HTTPSMS_API_KEY` (server-side only, never in frontend).
   - Correlation is strictly based on the provider's message identifier (`data.id` / `data.message_id`) matching `sos_sms_dispatches.provider_request_id`.
   - `request_id` is NOT passed in outbound payloads and NOT relied upon because httpSMS delivery reports return `request_id: null`.
   - Webhook security requires `Authorization: Bearer <JWT>` with HS256 signature verification matching `HTTPSMS_WEBHOOK_SIGNING_KEY`.

---

## 2. Official API & Webhook Contract Specification

### Outbound Dispatch Request (`POST /v1/messages/send`)
- **Headers**:
  - `x-api-key`: `<HTTPSMS_API_KEY>`
  - `Content-Type`: `application/json`
- **Request Body**:
  ```json
  {
    "from": "+919876543210",
    "to": "+918428077014",
    "content": "🚨 EMERGENCY SOS: Immediate assistance requested..."
  }
  ```
- **Response Shape (HTTP 202 Accepted)**:
  ```json
  {
    "status": "success",
    "message": "message added to queue",
    "data": {
      "id": "5be8f09e-7007-4fe9-86b6-591d63fd38ad",
      "owner": "+919876543210",
      "contact": "+918428077014",
      "content": "...",
      "status": "pending",
      "type": "outgoing",
      "created_at": "2026-09-16T07:15:00.000Z"
    }
  }
  ```
- **Internal Storage**:
  - Provider message ID (`data.id`) is stored in `sos_sms_dispatches.provider_request_id`.
  - Dispatch record state set to `SMS_SUBMITTED`.

### Asynchronous Inbound Webhook (`POST /functions/v1/httpsms-webhook`)
- **Headers**:
  - `Authorization`: `Bearer <HS256_JWT_TOKEN>`
  - `X-Event-Type`: `<EVENT_TYPE>`
  - `Content-Type`: `application/json`
- **Supported Events**:
  - `message.phone.sent`: Phone transmitted SMS; state remains `SMS_SUBMITTED`.
  - `message.phone.delivered`: Carrier delivered SMS; state transitions to `SMS_DELIVERY_CONFIRMED`.
  - `message.send.failed`: Transmission failed; state transitions to `SMS_DELIVERY_FAILED`.
  - `message.send.expired`: Message expired; state transitions to `SMS_DELIVERY_FAILED`.
- **Correlation**:
  - Extracted from `data.id` (or `data.message_id` for expired events).
  - Matches `sos_sms_dispatches.provider_request_id`.
  - Rejects unknown message IDs with 404.
  - Idempotent: `SMS_DELIVERY_CONFIRMED` can never be downgraded.

## 3. Hardware & SIM Requirements

| Component | Specification |
| :--- | :--- |
| **Device** | Dedicated Android smartphone running Android 8.0 (Oreo) or later |
| **SIM Card** | Active commercial SIM card inserted into Slot 1 (or designated default SIM) |
| **Carrier Plan** | Active plan with unlimited or bulk outgoing SMS allowance and SMS delivery report capability |
| **Power** | Continuously connected to AC power charger |
| **Network** | Uninterrupted connection to Wi-Fi and mobile data fallback |

---

## 4. Step-by-Step Setup Procedure

### Step 1: Install httpSMS Android Application
1. On the dedicated Android phone, download the official **httpSMS** application:
   - Official APK: [https://apk.httpsms.com/HttpSms.apk](https://apk.httpsms.com/HttpSms.apk)
   - Official GitHub Releases: [https://github.com/NdoleStudio/httpsms/releases](https://github.com/NdoleStudio/httpsms/releases)
2. Open the downloaded APK and complete installation (enable "Install from unknown sources" if prompted).

### Step 2: Sign In & Configure Device
1. Open the httpSMS app on the phone.
2. Sign in with your registered httpSMS account (created at [https://httpsms.com](https://httpsms.com)).
3. Grant all requested permissions:
   - **SMS**: Send and view SMS messages
   - **Phone**: Manage phone calls and access phone state / SIM information
   - **Notifications**: Display ongoing background service notification
4. **Disable Battery Optimization**:
   - Go to Android *Settings → Apps → httpSMS → Battery → Unrestricted / Do Not Optimize*.
   - Ensure background activity is permitted and "Auto-start" is enabled (especially on Xiaomi/MIUI, Samsung, or Oppo devices).

### Step 3: Verify the SIM and From Number
1. Note the exact E.164 phone number of the physical SIM in the phone (e.g., `+919876543210`).
2. In the httpSMS app, verify that the SIM card status displays **Active** and that the phone number matches.

### Step 4: Obtain API Credentials
1. Log into your httpSMS web console at [https://httpsms.com/settings](https://httpsms.com/settings).
2. Under **API Keys**, generate or copy your **API Key**.
3. Under **Webhooks**, note or set your **Webhook Signing Key** (a secure random string).

### Step 5: Configure Supabase Edge Function Secrets
Set the Edge Function secrets in your Supabase project (via CLI or Supabase Dashboard *Project Settings → Edge Functions*):

```bash
# Set httpSMS API credentials and sender number
supabase secrets set HTTPSMS_API_KEY="your_httpsms_api_key_here"
supabase secrets set HTTPSMS_FROM_NUMBER="+919876543210"

# Optional: Set custom API base URL if self-hosting (defaults to https://api.httpsms.com)
supabase secrets set HTTPSMS_BASE_URL="https://api.httpsms.com"

# Set Webhook Signing Key for verifying delivery callbacks
supabase secrets set HTTPSMS_WEBHOOK_SIGNING_KEY="your_webhook_signing_key_here"
```

> [!CAUTION]
> **NEVER** expose `HTTPSMS_API_KEY` or `HTTPSMS_WEBHOOK_SIGNING_KEY` to the client app or commit them into `.env.local` or Git. They must exist **only** as server-side Edge Function secrets.

### Step 6: Configure Webhook Callback in httpSMS Console
1. In the httpSMS dashboard, navigate to **Settings → Webhooks**.
2. Add a new Webhook:
   - **URL**: `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/httpsms-webhook`
   - **Events to Listen For**:
     - `message.phone.sent`
     - `message.phone.delivered`
     - `message.send.failed`
     - `message.send.expired`
   - **Signing Key**: Enter the same secret configured in `HTTPSMS_WEBHOOK_SIGNING_KEY`.
3. Save the webhook.

---

## 5. Controlled Verification & Testing Procedure

Do **NOT** test against emergency dispatchers or 112. Perform test dispatches using a single controlled phone number.

### Step 1: Add Controlled Test Number to Whitelist
Ensure your test number is present in `src/config/sosRecipients.js` and `supabase/functions/_shared/smsProvider.ts` in normalized E.164 format (+91...).

### Step 2: Trigger Controlled Server Dispatch
Invoke the `send-sos-sms` Edge Function via curl or Supabase Functions test runner:

```bash
curl -X POST "https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/send-sos-sms" \
  -H "Authorization: Bearer <ANON_OR_SERVICE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "sos_id": "test_verification_001",
    "station_code": "TN-CHN-001",
    "message": "🚨 TEST SOS ALERT - Gateway Verification Only. Disregard."
  }'
```

### Step 3: Verify Provider Submission
1. Confirm the HTTP response is **200 OK** with:
   ```json
   {
     "success": true,
     "state": "SMS_SUBMITTED",
     "provider": "httpSMS"
   }
   ```
2. Verify in Supabase table `sos_sms_dispatches` that the row has `state = 'SMS_SUBMITTED'`.

### Step 4: Verify Android Gateway Transmission
1. Look at the Android phone running httpSMS.
2. The phone should receive the queued message, and the Android SMS notification should indicate the SMS was sent via the physical SIM.
3. The controlled recipient handset receives the real SMS text message.

### Step 5: Verify Asynchronous Delivery Confirmation
1. Upon cellular carrier delivery to the test handset, the Android phone receives the carrier delivery report.
2. httpSMS posts the `message.phone.delivered` CloudEvent to `httpsms-webhook`.
3. Verify in Supabase table `sos_sms_dispatches` that `state` has transitioned to `SMS_DELIVERY_CONFIRMED`.

---

## 6. Maintenance & Troubleshooting

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| Edge Function returns `SMS_PROVIDER_NOT_CONFIGURED` | Missing `HTTPSMS_API_KEY` or `HTTPSMS_FROM_NUMBER` | Verify secrets in Supabase Dashboard and re-deploy |
| State stays on `SMS_SUBMITTED` without reaching `CONFIRMED` | Android phone offline, battery died, or carrier delivery report delayed | Verify phone power, Wi-Fi/mobile data, and that httpSMS app is running in foreground/background |
| Edge Function returns `SMS_PROVIDER_REJECTED` | Invalid API key or unformatted sender number | Verify API key on `httpsms.com/settings` and ensure sender number is in exact E.164 (`+91...`) format |
| Webhook returns `401 Unauthorized` | Mismatched `HTTPSMS_WEBHOOK_SIGNING_KEY` | Ensure identical signing secret in httpSMS webhook settings and Supabase secrets |
| Duplicate dispatches return `409 Conflict` | Idempotency protection active | Expected behavior: duplicate dispatches for the same `sos_id` are safely rejected |
