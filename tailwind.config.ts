import type { Config } from "tailwindcss";

/**
 * Dark "signal detection" theme shared by every screen.
 *
 * ink  -> background layers   paper -> foreground text
 * signal -> amber accent      noise -> lime "done" accent
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0F0D",
        "ink-surface": "#111714",
        "ink-border": "#1E2622",
        paper: "#EAEFEC",
        "paper-muted": "#93A29C",
        signal: "#FFB020",
        noise: "#D4F03E",
        // "awaiting human approval" accent on the kanban — the one column that
        // needs a person, not an agent.
        info: "#7AA9FF",
      },
      fontFamily: {
        display: ["Georgia", "ui-serif", "serif"],
      },
      keyframes: {
        sweep: {
          "0%": { transform: "rotate(0deg)", opacity: "0.2" },
          "50%": { opacity: "0.55" },
          "100%": { transform: "rotate(360deg)", opacity: "0.2" },
        },
        "ping-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        sweep: "sweep 7s linear infinite",
        "ping-soft": "ping-soft 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
