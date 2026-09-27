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
          'turquoise-dim': '#08ddbc14',
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
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
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
