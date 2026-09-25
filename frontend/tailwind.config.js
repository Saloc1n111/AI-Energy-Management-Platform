/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bia: {
          turquoise: '#08DDBC',
          'turquoise-hover': '#06c7a8',
          'turquoise-dim': '#08ddbc1f',
          navy: {
            950: '#040714', // Deepest midnight canvas
            900: '#070b22', // Nav, sidebar, major panels
            850: '#0d1335', // Card containers
            800: '#131b46', // Card hover / elevated items
            750: '#1b265e', // Subtle borders
            700: '#25347a', // Active borders
            600: '#384a9e',
            500: '#5266c2',
          },
          purple: '#8B5CF6',
          coral: '#FF4D6D',
          amber: '#FFB703',
          emerald: '#08DDBC',
        },
        zinc: {
          950: '#040714',
          900: '#070b22',
          850: '#0d1335',
          800: '#131b46',
          750: '#1b265e',
          700: '#25347a',
          600: '#384a9e',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          200: '#E2E8F0',
          100: '#F8FAFC',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': '0.6875rem', // 11px
      }
    },
  },
  plugins: [],
}
