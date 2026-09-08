/**
 * src/components/kavalan/GroqManager.jsx — Resilient Groq Client for REPORT v2
 * 
 * Strict rules:
 * 1. NEVER fabricate fake FIR data (e.g. Priya at Phoenix Mall).
 * 2. Robust JSON extraction with safe repair.
 * 3. Clear timeout and fallback handling so failures never crash the UI.
 */

export class GroqManager {
  constructor(apiKey) {
    this.apiKey = apiKey ? apiKey.trim() : "";
    this.primaryModel = "llama-3.3-70b-versatile";
    this.backupModels = [
      "llama-3.1-70b-versatile",
      "mixtral-8x7b-32768",
      "gemma-2-9b-it"
    ];
    this.baseURL = "https://api.groq.com/openai/v1/chat/completions";
  }

  hasValidKey() {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async chat(messages, maxTokens = 1200, temperature = 0.1, timeoutMs = 25000) {
    if (!this.hasValidKey()) {
      throw new Error("AI service is not configured (API key missing). You can continue entering details manually.");
    }

    const models = [this.primaryModel, ...this.backupModels];
    let lastError = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(this.baseURL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              model: model,
              messages: messages,
              max_tokens: maxTokens,
              temperature: temperature,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.status === 429) {
            console.warn(`⚠️ Groq Rate limit on ${model}, trying fallback model...`);
            break; // Try next model
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(`AI service returned HTTP ${response.status}: ${errorText.slice(0, 120)}`);
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

          // Backoff before retrying same model
          if (attempt < 1) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
    }

    // All models failed — throw honest error without fabricating data
    const reason = lastError?.message || "All AI models were unreachable";
    throw new Error(`We couldn't analyze the recording (${reason}). Your transcript is preserved. You can edit the details directly.`);
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

    // 1. Remove markdown backticks if present
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

    // 2. Locate first '{' and last '}'
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("No structured JSON object found in AI response.");
    }

    const jsonSub = cleaned.slice(firstBrace, lastBrace + 1);

    // 3. First try: standard parse
    try {
      return JSON.parse(jsonSub);
    } catch (err1) {
      // 4. Safe repair: remove trailing commas before closing braces/brackets
      const repaired = jsonSub
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":'); // ensure quotes on keys

      try {
        return JSON.parse(repaired);
      } catch (err2) {
        console.error("Failed to repair JSON:", jsonSub);
        throw new Error("AI returned malformed JSON that could not be repaired safely.");
      }
    }
  }
}

export default GroqManager;