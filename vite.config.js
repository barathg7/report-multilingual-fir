import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function apiDevMiddleware() {
  return {
    name: "api-dev-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {

        // ── /api/ai/groq — Server-side Groq proxy ─────────────────────────────
        // The browser NEVER receives the Groq API key.
        // Uses process.env.GROQ_API_KEY (NOT VITE_GROQ_API_KEY).
        // PRODUCTION: Handled by Vercel Serverless Function at api/ai/groq.js
        if (req.url?.startsWith("/api/ai/groq")) {
          if (req.method === "OPTIONS") {
            res.writeHead(200, {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
            });
            return res.end();
          }

          if (req.method !== "POST") {
            res.writeHead(405, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Method not allowed", message: "Only POST requests are permitted" }));
          }

          const groqKey = process.env.GROQ_API_KEY || "";
          if (!groqKey) {
            res.writeHead(503, { "Content-Type": "application/json" });
            return res.end(
              JSON.stringify({
                error: "AI service not configured",
                message:
                  "GROQ_API_KEY environment variable is not set on the server. " +
                  "Set it in your .env file (without VITE_ prefix) or in your hosting platform.",
              })
            );
          }

          let bodyStr = "";
          req.on("data", (chunk) => { bodyStr += chunk.toString(); });
          req.on("end", async () => {
            try {
              const body = JSON.parse(bodyStr);
              const { messages, maxTokens = 1200, temperature = 0.1, model: requestedModel } = body;

              if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Invalid messages", message: "messages must be an array of 1-30 items" }));
              }

              const ALLOWED_MODELS = [
                "groq/compound-mini",
                "groq/compound",
                "qwen/qwen3.6-27b",
                "qwen/qwen3.8-27b",
                "openai/gpt-oss-20b",
                "openai/gpt-oss-120b",
                "llama-3.3-70b-versatile",
                "llama-3.1-70b-versatile",
                "mixtral-8x7b-32768",
                "gemma-2-9b-it",
              ];
              const model = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : "groq/compound-mini";
              const clampedTokens = Math.min(Math.max(parseInt(maxTokens, 10) || 1200, 1), 4096);
              const clampedTemp = typeof temperature === "number" ? Math.min(Math.max(temperature, 0), 2) : 0.1;

              const groqRes = await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${groqKey}`,
                  },
                  body: JSON.stringify({
                    model,
                    messages,
                    max_tokens: clampedTokens,
                    temperature: clampedTemp,
                  }),
                }
              );

              const groqData = await groqRes.json();
              res.writeHead(groqRes.status, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              });
              res.end(JSON.stringify(groqData));
            } catch (err) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({ error: "AI proxy error", message: "Failed to communicate with AI provider" })
              );
            }
          });
          return;
        }

        if (req.url?.startsWith("/api/send-otp")) {
          if (req.method === "OPTIONS") {
            res.writeHead(200, {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            });
            return res.end();
          }

          let bodyStr = "";
          req.on("data", (chunk) => {
            bodyStr += chunk.toString();
          });
          req.on("end", () => {
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            try {
              const body = bodyStr ? JSON.parse(bodyStr) : {};
              const otp = body.otp || String(Math.floor(100000 + Math.random() * 900000));
              res.end(
                JSON.stringify({
                  success: true,
                  devMode: true,
                  devOtp: String(otp),
                  message: `OTP delivered for ${body.email || "citizen"}`,
                })
              );
            } catch {
              res.end(
                JSON.stringify({
                  success: true,
                  devMode: true,
                  devOtp: "123456",
                  message: "OTP generated in development mode",
                })
              );
            }
          });
          return;
        }

        if (req.url?.startsWith("/api/generate-fir")) {
          if (req.method === "OPTIONS") {
            res.writeHead(200, {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            });
            return res.end();
          }
          if (req.method === "GET") {
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ status: "ok", mode: "client-docx-fallback" }));
          }
          let bodyStr = "";
          req.on("data", (chunk) => {
            bodyStr += chunk.toString();
          });
          req.on("end", () => {
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(
              JSON.stringify({
                success: false,
                useClientFallback: true,
                error: "Local dev mode utilizes high-performance client-side DOCX generation",
              })
            );
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDevMiddleware()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("policeStations.js")) {
            return "police-stations-data";
          }
          if (id.includes("node_modules/docx") || id.includes("node_modules/file-saver")) {
            return "vendor-docx";
          }
          if (id.includes("node_modules/@maptiler")) {
            return "vendor-maptiler";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router-dom")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
        },
      },
    },
  },
});

