/**
 * src/components/kavalan/GroqManager.jsx — Resilient Groq Client for REPORT v2
 *
 * SECURITY (Phase 1.1):
 * - NO LONGER reads VITE_GROQ_API_KEY or any client-side API key.
 * - All Groq calls are proxied through /api/ai/groq (server-side).
 *   In dev: Vite middleware reads process.env.GROQ_API_KEY (no VITE_ prefix).
 *   In production: Supabase Edge Function at /functions/v1/ai-proxy holds the key.
 *
 * Strict rules:
 * 1. NEVER fabricate fake FIR data.
 * 2. Robust JSON extraction with safe repair.
 * 3. Clear error handling — failures never crash the UI or invent facts.
 */

const GROQ_PROXY_URL = "/api/ai/groq";

export class GroqManager {
  constructor() {
    // No API key stored client-side. All auth handled server-side.
    this.primaryModel = "groq/compound-mini";
    this.backupModels = [
      "groq/compound",
      "qwen/qwen3.6-27b",
      "qwen/qwen3.8-27b",
      "llama-3.3-70b-versatile",
    ];
  }

  async chat(messages, maxTokens = 1200, temperature = 0.1, timeoutMs = 25000) {
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

          if (response.status === 429) {
            console.warn(`⚠️ Groq Rate limit on ${model}, trying fallback model...`);
            break; // Try next model
          }

          if (response.status === 503) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(
              errData.message ||
                "AI service is not configured on the server. Set GROQ_API_KEY (without VITE_ prefix) in your server environment."
            );
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(`AI proxy returned HTTP ${response.status}: ${errorText.slice(0, 120)}`);
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content?.trim();

          if (!content) {
            throw new Error("Empty response received from AI service");
          }

          return content;

        } catch (error) {
          clearTimeout(timeoutId);
          lastError = error;

          if (error.name === "AbortError") {
            console.warn(`⏱️ Groq model ${model} timed out after ${timeoutMs}ms.`);
            break; // Try next model
          }

          if (attempt < 1) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
    }

    // All models failed — honest error, no fabricated data
    const reason = lastError?.message || "All AI models were unreachable";
    throw new Error(
      `We couldn't analyse the recording (${reason}). Your transcript is preserved. You can edit the details directly.`
    );
  }

  /**
   * Safely parses JSON from an LLM response string.
   * Handles markdown codeblocks, text wrappers, and minor malformations.
   */
  static safeParseJSON(rawText) {
    if (!rawText || typeof rawText !== "string") {
      throw new Error("Invalid or empty response to parse as JSON.");
    }

    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("No structured JSON object found in AI response.");
    }

    const jsonSub = cleaned.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(jsonSub);
    } catch (err1) {
      const repaired = jsonSub
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/(['\"])?([a-zA-Z0-9_]+)(['\"])?:/g, '"$2":');

      try {
        return JSON.parse(repaired);
      } catch (err2) {
        console.error("Failed to repair JSON:", jsonSub);
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