import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function apiDevMiddleware() {
  return {
    name: "api-dev-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
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

