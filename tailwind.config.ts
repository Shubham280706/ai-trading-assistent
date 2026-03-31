import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#08111f",
        foreground: "#f8fafc",
        card: "rgba(12, 25, 44, 0.72)",
        border: "rgba(148, 163, 184, 0.18)",
        primary: "#14b8a6",
        secondary: "#38bdf8",
        accent: "#f59e0b",
        danger: "#f43f5e",
        muted: "#8aa1c0"
      },
      boxShadow: {
        glow: "0 20px 80px rgba(20, 184, 166, 0.12)"
      },
      backgroundImage: {
        grid: "radial-gradient(circle at center, rgba(56, 189, 248, 0.18) 0, transparent 8%)"
      },
      animation: {
        float: "float 10s ease-in-out infinite"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
