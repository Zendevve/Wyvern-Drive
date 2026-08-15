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
        wyvern: {
          50: '#f4f5f9',
          100: '#e8eaf2',
          200: '#cbd1e4',
          300: '#9faacc',
          400: '#6f7fb0',
          500: '#5865F2', // Discord Blurple
          600: '#4752c4',
          700: '#3c45a5',
          800: '#343a85',
          900: '#1e2348',
          950: '#0b0e14', // Deep Obsidian
        },
        obsidian: {
          base: '#07090e',
          card: '#0e121b',
          elevated: '#151b27',
          border: '#1f2738',
          hover: '#283247',
        },
        accent: {
          cyan: '#00f2fe',
          teal: '#4facfe',
          emerald: '#10b981',
          violet: '#8b5cf6',
          amber: '#f59e0b',
          rose: '#f43f5e',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-blurple': '0 0 25px -5px rgba(88, 101, 242, 0.4)',
        'glow-cyan': '0 0 25px -5px rgba(0, 242, 254, 0.35)',
        'glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.35)',
        'inner-glow': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      }
    },
  },
  plugins: [],
}
