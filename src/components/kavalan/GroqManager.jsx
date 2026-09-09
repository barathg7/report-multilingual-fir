/**
 * src/components/kavalan/GroqManager.jsx — Resilient Groq Client for REPORT v2
 *
 * SECURITY (Phase 1.1):
 * - NO client-side API key. All Groq calls proxied through /api/ai/groq.
 *   In dev: Vite reads process.env.GROQ_API_KEY (no VITE_ prefix).
 *   In production: Vercel serverless function holds GROQ_API_KEY server-side.
 *
 * MODEL CHAIN — 16-case FIR benchmark (2026-09-09):
 * ─────────────────────────────────────────────────────────────────
 * Model                  Score   Lat(avg)  JSON mode  Fabrication  Notes
 * openai/gpt-oss-20b    15/16   1204ms    SUPPORTED  0/16         1 transient empty
 * openai/gpt-oss-120b   16/16   2186ms    NOT SUPP   0/16         perfect, no JSON mode
 * qwen/qwen3.8-27b      11/16    732ms    SUPPORTED  0/16         5 empty (rate-limited in bench)
 *
 * Chain:
 *   PRIMARY  : openai/gpt-oss-20b   — best reliability+speed balance
 *   FALLBACK1: openai/gpt-oss-120b  — perfect reliability, slowest
 *   FALLBACK2: qwen/qwen3.8-27b     — fast for English; last resort
 *   → safe application error if all three fail
 *
 * IMPORTANT — JSON mode compatibility:
 *   openai/gpt-oss-20b  : response_format json_object SUPPORTED
 *   openai/gpt-oss-120b : response_format json_object NOT SUPPORTED (returns 400)
 *   qwen/qwen3.8-27b    : response_format json_object SUPPORTED
 *   → We do NOT send response_format to avoid 400 on gpt-oss-120b.
 *   → All three return valid JSON from prompt instruction alone.
 *
 * EXCLUDED (document reasons; do NOT re-add without re-running benchmark):
 *   groq/compound-mini  — no tool/web-search contract in this app
 *   qwen/qwen3.6-27b    — emits <think> tags that corrupt JSON (1/4 old score)
 *   allam-2-7b          — invalid JSON output (1/4 old score)
 *   groq/compound       — agentic routing model
 *   llama-3.3/3.1-70b-versatile, mixtral-8x7b-32768,
 *   llama-3.1-8b-instant — NOT in this API key's plan
 *
 * ERROR CLASSIFICATION:
 * ─────────────────────────────────────────────────────────────────
 *   429, 500, 502, timeout, empty content → next model
 *   invalid JSON, schema fail              → next model
 *   400 model compat                       → next model
 *   401, 403, 503, 400-auth/schema         → fail immediately
 *
 * Strict rules:
 * 1. NEVER fabricate fake FIR data.
 * 2. Strip <think> tags; STRICT JSON parse — trailing-comma repair only.
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
    //
    // Chain based on 16-case benchmark 2026-09-09.
    // Re-run benchmark_fir_extraction.cjs before modifying.
    //
    // JSON mode compatibility (response_format: json_object):
    //   openai/gpt-oss-20b  : SUPPORTED
    //   openai/gpt-oss-120b : NOT SUPPORTED — returns HTTP 400 with JSON mode
    //   qwen/qwen3.8-27b    : SUPPORTED
    // → We do NOT send response_format to the proxy to avoid breaking gpt-oss-120b.
    //   All three produce valid JSON from prompt instruction alone.
    this.primaryModel = "openai/gpt-oss-20b";
    this.backupModels = [
      "openai/gpt-oss-120b",  // 16/16, highest reliability, no JSON mode
      "qwen/qwen3.8-27b",     // 11/16 in bench (rate-limited); fast last resort
      // groq/compound-mini intentionally excluded: this application has no
      // tool/web-search contract; excluded to keep extraction strictly predictable.
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

          // ── HTTP 400 — classify precisely ─────────────────────────────
          if (response.status === 400) {
            let errData = {};
            try { errData = await response.json(); } catch { /* ignore */ }
            const errType = errData?.error?.type || "";
            const errCode = errData?.error?.code || "";
            const errMsg  = errData?.error?.message || "";
            _logModelEvent(model, 400, errType, errMsg);

            // Fatal request errors — will fail identically on every model
            const isFatalRequest =
              errType === "authentication_error" ||
              errCode === "invalid_api_key" ||
              (errMsg.includes("messages") && errMsg.includes("required")) ||
              errMsg.includes("max_tokens exceeds");

            if (isFatalRequest) {
              throw new Error("AI request configuration error. Please contact support.");
            }

            // Model-specific incompatibility — skip to next model
            break;
          }

          // ── 401/403 — authentication failure — throw immediately ───────
          if (response.status === 401 || response.status === 403) {
            _logModelEvent(model, response.status, "auth_error", "authorization failed");
            throw new Error("AI service authorization failed. Please contact support.");
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
   *
   * Pipeline:
   *   1. Strip <think>...</think> reasoning tags (Qwen3/DeepSeek)
   *   2. Strip markdown code fences
   *   3. Extract outermost { ... } object
   *   4. Strict JSON.parse — only strip trailing commas as minimal repair
   *   5. Throw on failure — caller must try next model
   *
   * NEVER: aggressive key-unquoting or field invention.
   * If JSON cannot be parsed after minimal repair → throw, do not return partial data.
   */
  static safeParseJSON(rawText) {
    if (!rawText || typeof rawText !== "string") {
      throw new Error("Invalid or empty response to parse as JSON.");
    }

    // 1. Strip <think> tags (must run before JSON extraction)
    let cleaned = GroqManager._stripThinkTags(rawText).trim();

    // 2. Strip markdown code fences
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "");

    // 3. Find outermost JSON object
    const firstBrace = cleaned.indexOf("{");
    const lastBrace  = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("No JSON object found in model output.");
    }

    const jsonSub = cleaned.slice(firstBrace, lastBrace + 1);

    // 4. Strict parse — only minimal trailing-comma repair
    //    Do NOT unquote keys or invent missing fields.
    try {
      return JSON.parse(jsonSub);
    } catch {
      // One repair pass: trailing commas before } or ] only
      const minimal = jsonSub.replace(/,\s*([}\]])/g, "$1");
      try {
        return JSON.parse(minimal);
      } catch {
        // Cannot parse — caller must treat as model failure and try next
        throw new Error("Model returned malformed JSON — cannot parse safely.");
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