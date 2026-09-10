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
      },
      boxShadow: {
        "3d-card": "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
        "3d-card-hover": "0 4px 8px rgba(15, 23, 42, 0.05), 0 12px 24px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        "3d-button": "0 2px 0 rgba(15, 23, 42, 0.08), 0 4px 10px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
        "3d-button-primary": "0 2px 0 rgba(29, 78, 216, 0.6), 0 6px 16px rgba(37, 99, 235, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
        "3d-button-danger": "0 2px 0 rgba(190, 18, 60, 0.6), 0 6px 16px rgba(225, 29, 72, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
        "3d-button-success": "0 2px 0 rgba(4, 120, 87, 0.6), 0 6px 16px rgba(5, 150, 105, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
        "3d-floating": "0 16px 36px -6px rgba(15, 23, 42, 0.12), 0 6px 16px -2px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.85)",
        "3d-inset": "inset 0 2px 4px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};
