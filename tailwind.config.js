import { readFileSync } from 'node:fs';

// Colour lives in one place (src/design/tokens.json) so that Tailwind classes and the
// canvas/WebGL renderers, which cannot read classes, can never drift apart.
const t = JSON.parse(readFileSync(new URL('./src/design/tokens.json', import.meta.url), 'utf8'));

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        serif: ['"IBM Plex Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        surface: t.surface,
        line: t.line,
        fg: t.fg,
        // Provenance: the only hues that name an evidence class.
        obs: t.provenance.OBS,
        rep: t.provenance.REP,
        der: t.provenance.DER,
        na: t.provenance.NA,
        // Attention (degraded / partial / differs) and fault (error / mismatch).
        attn: t.attention,
        fault: t.fault,
        // Selection is neutral on purpose: choosing something never changes what it looks like.
        select: t.select,
        // Structure, not evidence: the colour a replay is drawn in (graph nodes, edges, tags).
        replay: t.classification.replay,
        // TRANSITIONAL aliases so unconverted screens keep rendering while workspaces are rebuilt one by one.
        // Removed when the last workspace is converted; `npm run audit:classes` and a grep prove none remain.
        ink: { 950: t.surface['0'], 900: t.surface['1'], 850: t.surface['1'], 800: t.surface['2'], 750: t.surface['3'], 700: t.line.DEFAULT, 600: t.line.strong, 500: t.fg['4'], 400: t.fg['3'], 300: t.fg['3'], 200: t.fg['2'], 100: t.fg['1'], 50: t.fg['1'] },
        teal: { accent: t.provenance.OBS, dim: t.provenance.OBS, muted: t.provenance.OBS },
        blue: { accent: t.provenance.REP, muted: t.provenance.REP },
        amber: { accent: t.attention, muted: t.attention },
        red: { accent: t.fault, muted: t.fault },
      },
      fontSize: {
        // Floor of 11px for anything that carries information.
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.25rem', { lineHeight: '1.625rem' }],
        '2xl': ['1.5rem', { lineHeight: '1.875rem' }],
      },
      borderRadius: { tag: '2px', ctl: '4px', panel: '6px' },
      boxShadow: {
        pop: '0 10px 30px -6px rgba(0,0,0,0.6), 0 0 0 1px rgba(236,232,223,0.06)',
        inset: 'inset 0 1px 0 rgba(236,232,223,0.035)',
        hairline: `0 1px 0 0 ${t.line.DEFAULT}`,
        'focus-inset': `inset 0 0 0 2px ${rgba(t.select, 0.45)}`,
      },
      transitionTimingFunction: { out: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
    },
  },
  plugins: [],
};
