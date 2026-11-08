import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FAF9F6",
        foreground: "#18181B",
        surface: "#FFFFFF",
        "surface-elevated": "#F4F4F0",
        border: "#E6E6E1",
        "border-active": "#D4D4CE",
        text: {
          primary: "#0F172A",
          secondary: "#52525B",
          muted: "#94A3B8",
        },
        primary: {
          DEFAULT: "#0F172A",
          hover: "#1E293B",
          subtle: "rgba(15, 23, 42, 0.05)",
          ring: "#0F172A",
        },
        accent: {
          DEFAULT: "#0284C7",
          hover: "#0369A1",
          subtle: "rgba(2, 132, 199, 0.08)",
          cyan: "#00D2FF",
        },
        permission: {
          tenant: "#0284C7",
          group: "#6366F1",
          private: "#D97706",
        },
        status: {
          ready: "#059669",
          failed: "#DC2626",
          processing: "#0284C7",
        },
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)",
        elevated: "0 12px 32px -8px rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
