import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tight: "-0.02em",
      },
      colors: {
        gold: "hsl(var(--gold))",
        signal: {
          positive: "hsl(var(--signal-positive))",
          "positive-soft": "hsl(var(--signal-positive-soft))",
          neutral: "hsl(var(--signal-neutral))",
          "neutral-soft": "hsl(var(--signal-neutral-soft))",
          caution: "hsl(var(--signal-caution))",
          "caution-soft": "hsl(var(--signal-caution-soft))",
        },
        // Admin panel tokens. Defined in index.css under `.admin-theme` with a
        // `[data-admin-theme="vedic"]` override; scoped to /admin and decoupled
        // from the `.vedic-theme` stylesheet. Bare HSL triples + <alpha-value>
        // so `bg-admin-ok/20` and friends keep working.
        admin: {
          bg: "hsl(var(--admin-bg) / <alpha-value>)",
          surface: "hsl(var(--admin-surface) / <alpha-value>)",
          "surface-2": "hsl(var(--admin-surface-2) / <alpha-value>)",
          "surface-3": "hsl(var(--admin-surface-3) / <alpha-value>)",
          border: "hsl(var(--admin-border) / <alpha-value>)",
          "border-subtle": "hsl(var(--admin-border-subtle) / <alpha-value>)",
          text: "hsl(var(--admin-text) / <alpha-value>)",
          "text-secondary": "hsl(var(--admin-text-secondary) / <alpha-value>)",
          "text-muted": "hsl(var(--admin-text-muted) / <alpha-value>)",
          "text-faint": "hsl(var(--admin-text-faint) / <alpha-value>)",
          ok: "hsl(var(--admin-ok) / <alpha-value>)",
          warn: "hsl(var(--admin-warn) / <alpha-value>)",
          danger: "hsl(var(--admin-danger) / <alpha-value>)",
          info: "hsl(var(--admin-info) / <alpha-value>)",
          indigo: "hsl(var(--admin-indigo) / <alpha-value>)",
          purple: "hsl(var(--admin-purple) / <alpha-value>)",
          cyan: "hsl(var(--admin-cyan) / <alpha-value>)",
          orange: "hsl(var(--admin-orange) / <alpha-value>)",
          "danger-strong": "hsl(var(--admin-danger-strong) / <alpha-value>)",
          "orange-strong": "hsl(var(--admin-orange-strong) / <alpha-value>)",
          "indigo-strong": "hsl(var(--admin-indigo-strong) / <alpha-value>)",
          "info-strong": "hsl(var(--admin-info-strong) / <alpha-value>)",
        },
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
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        favorable: {
          DEFAULT: "hsl(var(--favorable))",
          foreground: "hsl(var(--favorable-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "1.25rem",
        "2xl": "1.5rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "ticker-scroll": {
          "0%":   { transform: "translate3d(0, 0, 0)" },
          "100%": { transform: "translate3d(-33.3333%, 0, 0)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 30px -8px hsl(var(--gold) / 0.4)" },
          "50%": { boxShadow: "0 0 50px -4px hsl(var(--gold) / 0.7)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "ticker-scroll": "ticker-scroll 55s linear infinite",
        "float-slow": "float-slow 6s ease-in-out infinite",
        twinkle: "twinkle 3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
