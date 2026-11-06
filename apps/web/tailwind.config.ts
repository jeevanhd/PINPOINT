import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        pine: {
          DEFAULT: 'var(--pine)',
          soft: 'var(--pine-soft)',
          deep: 'var(--pine-deep)',
        },
        ember: {
          DEFAULT: 'var(--ember)',
          soft: 'var(--ember-soft)',
        },
        mustard: {
          DEFAULT: 'var(--mustard)',
          soft: 'var(--mustard-soft)',
        },
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        good: 'var(--good)',
        warn: 'var(--warn)',
        bad: 'var(--bad)',
      },
      fontFamily: {
        display: ['Fraunces', 'DM Serif Display', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        tile: '4px',
        card: '14px',
        sheet: '22px',
        pill: '999px',
      },
      boxShadow: {
        lift: '0 1px 2px rgba(35,32,28,0.06), 0 8px 24px -12px rgba(35,32,28,0.22)',
        pressed: 'inset 0 1px 2px rgba(35,32,28,0.18)',
      },
      backgroundImage: {
        grain: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
} satisfies Config;
