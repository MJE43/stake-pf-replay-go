import { fontFamily } from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "./components.json"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Syncopate", "Outfit", ...fontFamily.sans],
        sans: ["Outfit", "Fira Sans", ...fontFamily.sans],
        mono: ["Fira Code", ...fontFamily.mono],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
        },
        // Custom semantic colors
        glow: "hsl(var(--glow))",
        hit: "hsl(var(--hit))",
        copper: "hsl(var(--copper))",
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "calc(var(--radius) * 0.5)",
        md: "calc(var(--radius) * 1.5)",
        lg: "calc(var(--radius) * 2)",
        xl: "calc(var(--radius) * 3)",
      },
      boxShadow: {
        glow: "0 0 20px hsl(var(--glow) / 0.3)",
        "glow-lg": "0 0 40px hsl(var(--glow) / 0.4), 0 0 80px hsl(var(--glow) / 0.2)",
        hit: "0 0 20px hsl(var(--hit) / 0.3)",
        terminal: "inset 0 1px 0 hsl(var(--foreground) / 0.05)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "fade-in-up": {
          from: { opacity: 0, transform: "translateY(12px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 15px hsl(var(--glow) / 0.3)" },
          "50%": { boxShadow: "0 0 25px hsl(var(--glow) / 0.5), 0 0 40px hsl(var(--glow) / 0.2)" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)", opacity: 0 },
          "50%": { opacity: 0.5 },
          "100%": { transform: "translateY(100%)", opacity: 0 },
        },
        flicker: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.8 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "scan-line": "scan-line 3s ease-in-out infinite",
        flicker: "flicker 0.1s ease-in-out infinite",
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
        112: "28rem",
        128: "32rem",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
