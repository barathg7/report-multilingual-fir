// api/ai/groq.js — Production Vercel Serverless Function for Groq AI Proxy
// Architecture: Browser -> /api/ai/groq -> api/ai/groq.js -> api.groq.com
//
// Security guarantees:
// 1. GROQ_API_KEY exists ONLY server-side (process.env.GROQ_API_KEY).
// 2. Zero exposure of API keys in browser bundles, responses, or error logs.
// 3. Fails closed (503) if server key is not configured.
// 4. Validates request structure, roles, and model whitelisting.
// 5. Enforces total payload and token limits to prevent prompt-flooding / DoS.

const ALLOWED_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  // groq/compound-*, qwen/*, openai/gpt-oss-* intentionally excluded:
  // those models use tool-call contracts and return empty text, causing
  // Groq's "model output must contain either output text or tool calls" error.
]);

const ALLOWED_ROLES = new Set(["system", "user", "assistant"]);
const MAX_MESSAGES = 30;
const MAX_TOTAL_CHARS = 50000;
const MAX_TOKENS_CEILING = 4096;

export default async function handler(req, res) {
  // 1. Set Security & CORS Headers
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // 2. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 3. Enforce POST Method
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      message: "Only POST requests are accepted by the AI proxy.",
    });
  }

  // 4. Fail Closed: Check Server-Side Secret
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey || typeof groqKey !== "string" || !groqKey.trim()) {
    return res.status(503).json({
      error: "AI service not configured",
      message: "GROQ_API_KEY environment variable is not configured on the server.",
    });
  }

  // 5. Parse Request Body Safely
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }

  if ((!body || typeof body !== "object") && typeof req.on === "function") {
    body = await new Promise((resolve) => {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk.toString();
        // Guard against massive raw streaming bodies (> 1MB)
        if (raw.length > 1000000) {
          resolve(null);
        }
      });
      req.on("end", () => {
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(null);
        }
      });
      req.on("error", () => resolve(null));
    });
  }

  if (!body || typeof body !== "object") {
    return res.status(400).json({
      error: "Invalid request",
      message: "Request body must be a valid JSON object.",
    });
  }

  // 6. Validate Request Shape & Input Limits
  const { messages, maxTokens = 1200, temperature = 0.1, model: requestedModel } = body;

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return res.status(400).json({
      error: "Invalid messages array",
      message: `messages must be an array containing between 1 and ${MAX_MESSAGES} items.`,
    });
  }

  let totalChars = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object" || !ALLOWED_ROLES.has(msg.role) || typeof msg.content !== "string") {
      return res.status(400).json({
        error: "Invalid message item",
        message: `Message at index ${i} must have a valid role ('system', 'user', 'assistant') and string content.`,
      });
    }
    totalChars += msg.content.length;
  }

  if (totalChars > MAX_TOTAL_CHARS) {
    return res.status(413).json({
      error: "Payload too large",
      message: `Total messages content (${totalChars} chars) exceeds the allowed limit of ${MAX_TOTAL_CHARS} chars.`,
    });
  }

  // Whitelist Model Selection
  const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : "llama-3.3-70b-versatile";

  // Bound Parameters
  const clampedTokens = Math.min(Math.max(parseInt(maxTokens, 10) || 1200, 1), MAX_TOKENS_CEILING);
  const clampedTemp = typeof temperature === "number" ? Math.min(Math.max(temperature, 0.0), 2.0) : 0.1;

  // 7. Dispatch Forward Request to Groq API
  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: clampedTokens,
        temperature: clampedTemp,
      }),
    });

    const data = await groqRes.json().catch(() => null);

    if (!data) {
      return res.status(502).json({
        error: "Bad Gateway",
        message: "Failed to parse response from AI inference provider.",
      });
    }

    return res.status(groqRes.status).json(data);
  } catch (err) {
    // Sanitize log: Never print authorization tokens or secrets
    console.error("AI Proxy upstream error:", err.name || "NetworkError");
    return res.status(502).json({
      error: "AI Gateway Error",
      message: "An error occurred while communicating with the upstream AI provider.",
    });
  }
}
