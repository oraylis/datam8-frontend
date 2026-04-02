import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--ui-border))",
        input: "hsl(var(--ui-input))",
        ring: "hsl(var(--ui-ring))",
        background: "hsl(var(--ui-background))",
        foreground: "hsl(var(--ui-foreground))",
        sidebar: "hsl(var(--ui-surface-sidebar))",
        workspace: "hsl(var(--ui-surface-workspace))",
        elevated: "hsl(var(--ui-surface-elevated))",
        primary: {
          DEFAULT: "hsl(var(--ui-primary))",
          foreground: "hsl(var(--ui-primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--ui-secondary))",
          foreground: "hsl(var(--ui-secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--ui-destructive))",
          foreground: "hsl(var(--ui-destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--ui-muted))",
          foreground: "hsl(var(--ui-muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--ui-accent))",
          foreground: "hsl(var(--ui-accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--ui-popover))",
          foreground: "hsl(var(--ui-popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--ui-card))",
          foreground: "hsl(var(--ui-card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--ui-radius-lg)",
        md: "var(--ui-radius-md)",
        sm: "var(--ui-radius-sm)",
        xl: "var(--ui-radius-xl)",
        "2xl": "var(--ui-radius-2xl)",
      },
      fontFamily: {
        sans: ["Manrope", "Inter", "SF Pro Display", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        elevation: "var(--ui-shadow-lg)",
        soft: "var(--ui-shadow-md)",
      },
    },
  },
  plugins: [animate],
};

export default config;
