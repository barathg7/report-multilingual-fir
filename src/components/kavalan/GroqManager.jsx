/**
 * src/components/kavalan/GroqManager.jsx — Resilient Groq Client for REPORT v2
 *
 * SECURITY (Phase 1.1):
 * - NO client-side API key. All Groq calls proxied through /api/ai/groq.
 *   In dev: Vite reads process.env.GROQ_API_KEY (no VITE_ prefix).
 *   In production: Vercel serverless function holds GROQ_API_KEY server-side.
 *
 * MODEL SELECTION — Verified against live Groq API on 2026-09-09:
 * ─────────────────────────────────────────────────────────────────
 * This account has 14 models; llama/mixtral/gemma are NOT present.
 * Benchmark results (FIR JSON extraction, 4-point score):
 *
 *   PRIMARY  : qwen/qwen3.8-27b      score=4/4, latency≈1025ms, no think-tags
 *   FALLBACK1: openai/gpt-oss-20b    score=4/4, latency≈2262ms
 *   FALLBACK2: openai/gpt-oss-120b   score=4/4, latency≈2258ms, highest quality
 *   FALLBACK3: groq/compound-mini    score=4/4, latency≈3245ms, last resort
 *
 * EXCLUDED (with reasons):
 *   qwen/qwen3.6-27b  — emits <think> reasoning tags that corrupt JSON (1/4)
 *   allam-2-7b        — invalid JSON output for FIR extraction (1/4)
 *   groq/compound     — redundant with compound-mini; slower
 *   llama-3.3-70b-versatile, llama-3.1-70b-versatile,
 *   mixtral-8x7b-32768, llama-3.1-8b-instant — NOT in this API key's plan
 *
 * ERROR CLASSIFICATION:
 * ─────────────────────────────────────────────────────────────────
 *   RETRY / TRY-NEXT: 429, 500, 502, timeout, empty content
 *   TRY-NEXT ONLY:    400 with model compatibility errors
 *   THROW IMMEDIATELY: 503 (key not set), 400 auth/schema errors
 *
 * Strict rules:
 * 1. NEVER fabricate fake FIR data.
 * 2. Strip <think> tags; robust JSON extraction with safe repair.
 * 3. Failures never crash UI or expose API keys to client.
 */

const GROQ_PROXY_URL = "/api/ai/groq";

// Internal event log — sanitized, never exposes keys or FIR content
function _logModelEvent(model, httpStatus, errType, errMsg) {
  console.warn(
    `[GroqManager] model=${model} http=${httpStatus}` +
    (errType ? ` type=${errType}` : "") +
    (errMsg  ? ` msg=${String(errMsg).slice(0, 80)}` : "")
  );
}

export class GroqManager {
  constructor() {
    // No API key stored client-side. All auth handled server-side.
    // Models verified live against Groq API 2026-09-09.
    // Re-run audit_groq_models.cjs + test_fir_extraction.cjs before changing.
    this.primaryModel = "qwen/qwen3.8-27b";
    this.backupModels = [
      "openai/gpt-oss-20b",    // score=4/4, latency~2262ms
      "openai/gpt-oss-120b",   // score=4/4, latency~2258ms, highest quality
      "groq/compound-mini",    // score=4/4, latency~3245ms, last resort
    ];
  }

  /**
   * Sends a chat request to the AI proxy with fallback chain.
   * Retries on transient failures; falls through to backup models on model errors.
   * Strips Qwen3 <think> reasoning tags before returning content.
   */
  async chat(messages, maxTokens = 1200, temperature = 0.1, timeoutMs = 28000) {
    const models = [this.primaryModel, ...this.backupModels];
    let lastError = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(GROQ_PROXY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages, maxTokens, temperature }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // ── Rate limit — skip to next model ──────────────────────────
          if (response.status === 429) {
            _logModelEvent(model, 429, "rate_limit_exceeded", "rate limited");
            break;
          }

          // ── Transient server errors — retry same model once ───────────
          if (response.status === 500 || response.status === 502) {
            _logModelEvent(model, response.status, "upstream_error", "server error");
            lastError = new Error(`Model ${model} returned HTTP ${response.status}`);
            if (attempt < 1) { await new Promise((r) => setTimeout(r, 1500)); continue; }
            break;
          }

          // ── Proxy config error — throw immediately ────────────────────
          if (response.status === 503) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(
              errData.message ||
              "AI service is not configured on the server. Contact administrator."
            );
          }

          // ── HTTP 400 — classify precisely (do NOT blindly skip) ───────
          if (response.status === 400) {
            let errData = {};
            try { errData = await response.json(); } catch { /* ignore */ }
            const errType = errData?.error?.type || "";
            const errCode = errData?.error?.code || "";
            const errMsg  = errData?.error?.message || "";
            _logModelEvent(model, 400, errType, errMsg);

            // Fatal request errors (same error on every model — don't cycle)
            const isFatalRequest =
              errType === "authentication_error" ||
              errCode === "invalid_api_key" ||
              (errMsg.includes("messages") && errMsg.includes("required")) ||
              errMsg.includes("max_tokens exceeds");

            if (isFatalRequest) {
              throw new Error(
                "AI request configuration error. Please contact support."
              );
            }

            // Model-specific incompatibility (output contract mismatch) — try next
            break;
          }

          // ── Other non-2xx — retry once then move to next model ────────
          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            _logModelEvent(model, response.status, "unknown", errorText.slice(0, 80));
            lastError = new Error(`AI proxy returned HTTP ${response.status}`);
            if (attempt < 1) { await new Promise((r) => setTimeout(r, 1000)); continue; }
            break;
          }

          // ── HTTP 200 — validate response shape ────────────────────────
          const data = await response.json().catch(() => null);
          if (!data) {
            lastError = new Error("Failed to parse JSON from AI proxy");
            break;
          }

          const choice = data?.choices?.[0];
          if (!choice || !choice.message) {
            _logModelEvent(model, 200, "invalid_shape", "missing choices[0].message");
            lastError = new Error(`Model ${model} returned invalid response shape`);
            break;
          }

          let content = choice.message.content;
          const toolCalls = choice.message.tool_calls;

          // Require usable text content for FIR extraction
          if (!content || typeof content !== "string" || !content.trim()) {
            if (toolCalls) {
              _logModelEvent(model, 200, "tool_calls_only", "model returned tool_calls instead of text");
            } else {
              _logModelEvent(model, 200, "empty_content", "empty model output");
            }
            lastError = new Error(`Model ${model} returned empty text content`);
            break;
          }

          // Strip Qwen3/DeepSeek <think>...</think> reasoning-chain tags
          content = GroqManager._stripThinkTags(content);
          if (!content.trim()) {
            lastError = new Error(`Model ${model} returned only think-tag content`);
            break;
          }

          return content.trim();

        } catch (error) {
          clearTimeout(timeoutId);

          if (error.name === "AbortError") {
            _logModelEvent(model, -1, "timeout", `timed out after ${timeoutMs}ms`);
            lastError = new Error(`Model ${model} timed out`);
            break;
          }

          // Re-throw fatal errors without cycling through models
          if (
            error.message?.includes("not configured") ||
            error.message?.includes("configuration error") ||
            error.message?.includes("authentication")
          ) {
            throw error;
          }

          lastError = error;
          if (attempt < 1) { await new Promise((r) => setTimeout(r, 1000)); }
        }
      }
    }

    // All models exhausted — user-safe message, no internal details leaked
    const reason = lastError?.message || "All AI models were unreachable";
    throw new Error(
      `AI extraction is temporarily unavailable (${reason}). ` +
      "Your transcript has been preserved — please edit the fields directly."
    );
  }

  /**
   * Strips Qwen3 / DeepSeek <think>...</think> reasoning-chain tags.
   * Must run BEFORE JSON parsing; these tags corrupt JSON extraction.
   */
  static _stripThinkTags(text) {
    if (typeof text !== "string") return text;
    return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  }

  /**
   * Safely parses JSON from an LLM response string.
   * Applies think-tag stripping, markdown fence removal, and safe repair.
   */
  static safeParseJSON(rawText) {
    if (!rawText || typeof rawText !== "string") {
      throw new Error("Invalid or empty response to parse as JSON.");
    }

    // Strip think tags first (defensive — safe even if none present)
    let cleaned = GroqManager._stripThinkTags(rawText).trim();

    // Strip markdown code fences
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "");

    const firstBrace = cleaned.indexOf("{");
    const lastBrace  = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("No structured JSON object found in AI response.");
    }

    const jsonSub = cleaned.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(jsonSub);
    } catch {
      // Attempt minimal repair: trailing commas, unquoted keys
      const repaired = jsonSub
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');

      try {
        return JSON.parse(repaired);
      } catch {
        throw new Error("AI returned malformed JSON that could not be repaired safely.");
      }
    }
  }

  /**
   * Instance helper that delegates to safeParseJSON
   */
  safeExtractJSON(rawText) {
    return GroqManager.safeParseJSON(rawText);
  }
}

export default GroqManager;