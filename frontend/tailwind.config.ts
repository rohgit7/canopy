import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        backgroundSoft: "var(--bg-soft)",
        surface: "var(--surface)",
        primary: "var(--primary)",
        accent: "var(--accent)",
        text: "var(--text)",
        muted: "var(--text-muted)",
        border: "var(--border)",
        // Override slate shades to align with #161D26 base
        slate: {
          950: "#161D26", // was #020617 — now matches our base bg
          900: "#1e2736", // was #0f172a — slightly elevated surface
          800: "#252e3d", // was #1e293b — border/divider level
          700: "#2e3d52", // was #334155
          600: "#4a5568",
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
          200: "#e2e8f0",
          100: "#f1f5f9",
          50:  "#f8fafc",
        },
      },
    },
  },
  plugins: [],
};
export default config;

