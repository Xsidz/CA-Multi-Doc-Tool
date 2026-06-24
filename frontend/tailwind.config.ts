import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#1E3A5F",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#0F766E",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#F59E0B",
          foreground: "#0F172A",
        },
        background: "#F8FAFC",
        foreground: "#0F172A",
        muted: {
          DEFAULT: "#F1F3F5",
          foreground: "#6B7280",
        },
        border: "#E4E7EB",
        input: "#E4E7EB",
        ring: "#1E3A5F",
        destructive: {
          DEFAULT: "#DC2626",
          foreground: "#FFFFFF",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#0F172A",
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#0F172A",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
