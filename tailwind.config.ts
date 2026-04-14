import type { Config } from 'tailwindcss';

export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        panel: 'rgb(var(--color-panel) / <alpha-value>)',
        panelElevated: 'rgb(var(--color-panel-elevated) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        text: 'rgb(var(--color-text) / <alpha-value>)',
        textSecondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
        textMuted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        accentFg: 'rgb(var(--color-accent-foreground) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        ring: 'rgb(var(--color-ring) / <alpha-value>)'
      },
      borderRadius: {
        control: 'var(--radius-control)',
        panel: 'var(--radius-panel)',
        modal: 'var(--radius-modal)',
        composer: 'var(--radius-composer)'
      },
      boxShadow: {
        shell: 'var(--shadow-shell)',
        modal: 'var(--shadow-modal)'
      },
      fontFamily: {
        sans: ['var(--font-sans)']
      },
      transitionDuration: {
        fast: 'var(--motion-fast)',
        base: 'var(--motion-base)'
      }
    }
  },
  plugins: []
} satisfies Config;
