/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        civic: {
          navy: {
            800: "#131f37",
            900: "#0b132b",
            950: "#050b1a",
          },
          blue: {
            50:  "#f0f6ff",
            100: "#e0edfe",
            200: "#bae0fd",
            500: "#2563eb",
            600: "#1d4ed8",
            700: "#1e40af",
            800: "#1e3a8a",
            900: "#172554",
          },
          emerald: {
            50:  "#ecfdf5",
            100: "#d1fae5",
            600: "#059669",
            700: "#047857",
            800: "#065f46",
          },
          amber: {
            50:  "#fffbeb",
            100: "#fef3c7",
            600: "#d97706",
            700: "#b45309",
            800: "#92400e",
          },
          rose: {
            50:  "#fff1f2",
            100: "#ffe4e6",
            600: "#e11d48",
            700: "#be123c",
            800: "#9f1239",
          },
        },
        cyber: {
          950: "#030712",
          900: "#060d1e",
          850: "#0a1329",
          800: "#0f1c3d",
          700: "#162852",
          600: "#1f3870",
        },
        neon: {
          cyan: "#00f2fe",
          blue: "#4facfe",
          purple: "#7f00ff",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e",
        },
      },
      boxShadow: {
        "3d-card": "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
        "3d-card-hover": "0 8px 24px rgba(15, 23, 42, 0.08), 0 16px 36px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.95)",
        "3d-button": "0 2px 0 rgba(15, 23, 42, 0.08), 0 4px 10px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
        "3d-button-primary": "0 3px 0 rgba(29, 78, 216, 0.8), 0 8px 24px rgba(37, 99, 235, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
        "3d-button-danger": "0 3px 0 rgba(190, 18, 60, 0.8), 0 8px 24px rgba(225, 29, 72, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
        "3d-button-success": "0 3px 0 rgba(4, 120, 87, 0.8), 0 8px 24px rgba(5, 150, 105, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
        "3d-floating": "0 20px 40px -10px rgba(15, 23, 42, 0.15), 0 8px 20px -4px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        "3d-glow-blue": "0 0 35px -5px rgba(37, 99, 235, 0.45), 0 0 15px rgba(59, 130, 246, 0.3)",
        "3d-glow-cyan": "0 0 35px -5px rgba(6, 182, 212, 0.45), 0 0 15px rgba(34, 211, 238, 0.3)",
        "3d-glow-rose": "0 0 35px -5px rgba(244, 63, 94, 0.5), 0 0 15px rgba(225, 29, 72, 0.3)",
        "3d-glass": "0 8px 32px 0 rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.7)",
        "3d-glass-dark": "0 12px 40px 0 rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        "3d-inset": "inset 0 2px 4px rgba(15, 23, 42, 0.08)",
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 20s linear infinite",
        "radar-sweep": "radar 4s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        radar: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
    },
  },
  plugins: [],
};
