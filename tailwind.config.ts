import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        // Editorial serif for headlines + statute citations (used with restraint).
        display: ['var(--font-display)', 'Georgia', 'ui-serif', 'serif'],
        serif: ['var(--font-display)', 'Georgia', 'ui-serif', 'serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        // Statutory-deadline accent — the single warm tone, used only where the
        // law's clock turns in the user's favor.
        deadline: {
          DEFAULT: 'hsl(var(--deadline))',
          foreground: 'hsl(var(--deadline-foreground))',
          soft: 'hsl(var(--deadline-soft))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Sidebar palette (dark ink navy). These CSS vars are defined in
        // globals.css but were never registered here, so `bg-sidebar-background`
        // et al. generated NO CSS — the sidebar fell back to the light page
        // background (invisible white logo, no contrast vs. the canvas). Mapping
        // them restores the intended dark sidebar.
        'sidebar-background': 'hsl(var(--sidebar-background))',
        'sidebar-foreground': 'hsl(var(--sidebar-foreground))',
        'sidebar-primary': 'hsl(var(--sidebar-primary))',
        'sidebar-primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
        'sidebar-accent': 'hsl(var(--sidebar-accent))',
        'sidebar-accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
        'sidebar-border': 'hsl(var(--sidebar-border))',
        'sidebar-ring': 'hsl(var(--sidebar-ring))',
        'sidebar-muted': 'hsl(var(--sidebar-muted))',
      },
      borderRadius: {
        '2xl': 'calc(var(--radius) + 8px)',  /* 20px — premium cards */
        xl: 'calc(var(--radius) + 4px)',      /* 16px */
        lg: 'var(--radius)',                   /* 12px */
        md: 'calc(var(--radius) - 2px)',       /* 10px */
        sm: 'calc(var(--radius) - 4px)',       /* 8px */
      },
      boxShadow: {
        'premium': '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)',
        'premium-lg': '0 2px 4px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.05)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS-only package
  plugins: [require('tailwindcss-animate')],
};

export default config;
