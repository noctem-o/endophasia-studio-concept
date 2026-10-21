/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: {
          950: '#0A0E12',
          900: '#0D1218',
          850: '#10161D',
          800: '#141B23',
          750: '#19212B',
          700: '#1F2833',
          600: '#2A3542',
          500: '#3A4757',
          400: '#54637A',
          300: '#7C8CA5',
          200: '#A7B4C7',
          100: '#D3DBE6',
          50: '#EDF1F6',
        },
        teal: {
          accent: '#2DD4BF',
          dim: '#14B8A6',
          muted: '#0F766E',
        },
        blue: {
          accent: '#60A5FA',
          muted: '#3B82F6',
        },
        amber: {
          accent: '#F5B94B',
          muted: '#D97706',
        },
        red: {
          accent: '#F87171',
          muted: '#DC2626',
        },
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
};
