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
        background: "#090D16",
        surface: "#0F172A",
        "surface-elevated": "#1E293B",
        border: "#334155",
        primary: {
          DEFAULT: "#6366F1",
          hover: "#4F46E5",
        },
        permission: {
          tenant: "#38BDF8",
          group: "#818CF8",
          private: "#F59E0B",
        },
        status: {
          ready: "#10B981",
          failed: "#EF4444",
          processing: "#3B82F6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
