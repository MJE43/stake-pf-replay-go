import { fontFamily } from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "./components.json"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        serif: ["var(--font-serif)", ...fontFamily.serif],
        mono: ["var(--font-mono)", ...fontFamily.mono],
        caption: ['"Fira Sans"', ...fontFamily.sans],
        "caption-bold": ['"Fira Sans"', ...fontFamily.sans],
        body: ['"Fira Sans"', ...fontFamily.sans],
        "body-bold": ['"Fira Sans"', ...fontFamily.sans],
        "heading-3": ['"Fira Sans"', ...fontFamily.sans],
        "heading-2": ['"Fira Sans"', ...fontFamily.sans],
        "heading-1": ['"Fira Sans"', ...fontFamily.sans],
        "monospace-body": ["monospace"],
      },
      colors: {
        // shadcn/ui colors (keep for component compatibility)
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
        // New brand color palette
        brand: {
          50: "rgb(8, 38, 54)",
          100: "rgb(8, 45, 65)",
          200: "rgb(8, 53, 76)",
          300: "rgb(8, 62, 89)",
          400: "rgb(6, 75, 107)",
          500: "rgb(0, 93, 133)",
          600: "rgb(104, 221, 253)",
          700: "rgb(138, 232, 255)",
          800: "rgb(46, 200, 238)",
          900: "rgb(234, 248, 255)",
        },
        neutral: {
          0: "rgb(10, 10, 10)",
          50: "rgb(23, 23, 23)",
          100: "rgb(38, 38, 38)",
          200: "rgb(64, 64, 64)",
          300: "rgb(82, 82, 82)",
          400: "rgb(115, 115, 115)",
          500: "rgb(163, 163, 163)",
          600: "rgb(212, 212, 212)",
          700: "rgb(229, 229, 229)",
          800: "rgb(245, 245, 245)",
          900: "rgb(250, 250, 250)",
          950: "rgb(255, 255, 255)",
        },
        error: {
          50: "rgb(60, 24, 39)",
          100: "rgb(72, 26, 45)",
          200: "rgb(84, 27, 51)",
          300: "rgb(100, 29, 59)",
          400: "rgb(128, 29, 69)",
          500: "rgb(174, 25, 85)",
          600: "rgb(233, 61, 130)",
          700: "rgb(240, 79, 136)",
          800: "rgb(247, 97, 144)",
          900: "rgb(254, 236, 244)",
        },
        warning: {
          50: "rgb(52, 28, 0)",
          100: "rgb(63, 34, 0)",
          200: "rgb(74, 41, 0)",
          300: "rgb(87, 51, 0)",
          400: "rgb(105, 63, 5)",
          500: "rgb(130, 78, 0)",
          600: "rgb(255, 178, 36)",
          700: "rgb(255, 203, 71)",
          800: "rgb(241, 161, 13)",
          900: "rgb(254, 243, 221)",
        },
        success: {
          50: "rgb(19, 40, 25)",
          100: "rgb(22, 48, 29)",
          200: "rgb(25, 57, 33)",
          300: "rgb(29, 68, 39)",
          400: "rgb(36, 85, 48)",
          500: "rgb(47, 110, 59)",
          600: "rgb(70, 167, 88)",
          700: "rgb(85, 180, 103)",
          800: "rgb(99, 193, 116)",
          900: "rgb(229, 251, 235)",
        },
        "brand-primary": "rgb(104, 221, 253)",
        "default-font": "rgb(250, 250, 250)",
        "subtext-color": "rgb(163, 163, 163)",
        "neutral-border": "rgb(64, 64, 64)",
        black: "rgb(10, 10, 10)",
        "default-background": "rgb(10, 10, 10)",
      },
      fontSize: {
        caption: [
          "12px",
          {
            lineHeight: "16px",
            fontWeight: "400",
            letterSpacing: "0em",
          },
        ],
        "caption-bold": [
          "12px",
          {
            lineHeight: "16px",
            fontWeight: "600",
            letterSpacing: "0em",
          },
        ],
        body: [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "400",
            letterSpacing: "0em",
          },
        ],
        "body-bold": [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "600",
            letterSpacing: "0em",
          },
        ],
        "heading-3": [
          "16px",
          {
            lineHeight: "20px",
            fontWeight: "700",
            letterSpacing: "0em",
          },
        ],
        "heading-2": [
          "20px",
          {
            lineHeight: "24px",
            fontWeight: "700",
            letterSpacing: "0em",
          },
        ],
        "heading-1": [
          "30px",
          {
            lineHeight: "36px",
            fontWeight: "700",
            letterSpacing: "0em",
          },
        ],
        "monospace-body": [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "400",
            letterSpacing: "0em",
          },
        ],
      },
      boxShadow: {
        sm: "0px 1px 2px 0px rgba(0, 0, 0, 0.05)",
        DEFAULT: "0px 1px 2px 0px rgba(0, 0, 0, 0.05)",
        md: "0px 4px 16px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -1px rgba(0, 0, 0, 0.08)",
        lg: "0px 12px 32px -4px rgba(0, 0, 0, 0.08), 0px 4px 8px -2px rgba(0, 0, 0, 0.08)",
        overlay: "0px 12px 32px -4px rgba(0, 0, 0, 0.08), 0px 4px 8px -2px rgba(0, 0, 0, 0.08)",
      },
      borderRadius: {
        sm: "12px",
        md: "16px",
        DEFAULT: "16px",
        lg: "24px",
        full: "9999px",
        // Keep CSS variable radius for shadcn components
        "radius-var": "var(--radius)",
      },
      spacing: {
        112: "28rem",
        144: "36rem",
        192: "48rem",
        256: "64rem",
        320: "80rem",
      },
      container: {
        padding: {
          DEFAULT: "16px",
          sm: "calc((100vw + 16px - 640px) / 2)",
          md: "calc((100vw + 16px - 768px) / 2)",
          lg: "calc((100vw + 16px - 1024px) / 2)",
          xl: "calc((100vw + 16px - 1280px) / 2)",
          "2xl": "calc((100vw + 16px - 1536px) / 2)",
        },
      },
      screens: {
        mobile: {
          max: "767px",
        },
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
        shine: {
          "0%": { backgroundPosition: "200% 0" },
          "25%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        gradientFlow: {
          "0%": { "background-position": "0% 50%" },
          "50%": { "background-position": "100% 50%" },
          "100%": { "background-position": "0% 50%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shine: "shine 3s ease-out infinite",
        "gradient-flow": "gradientFlow 10s ease 0s infinite normal none running",
      },
    },
  },
  plugins: [],
};
