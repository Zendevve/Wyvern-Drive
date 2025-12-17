/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Wyvern Violet Palette
        bg: {
          app: '#0F0F11',      // Deep Charcoal / Violet-Black
          sidebar: '#0F0F11',  // Deep Charcoal
          card: '#18181B',     // Dark Violet-Grey (Surface)
          input: '#27272A',    // Zinc-800
          hover: '#27272A',    // Surface Hover
        },
        border: {
          card: '#27272A',     // Zinc-800
          divider: '#27272A',  // Zinc-800
          active: '#3F3F46',   // Zinc-700
          highlight: '#8B5CF6',// Violet-500
        },
        text: {
          main: '#FFFFFF',     // White
          secondary: '#A1A1AA',// Zinc-400
          tertiary: '#71717A', // Zinc-500
          label: '#52525B',    // Zinc-600
          accent: '#8B5CF6',   // Violet-500
        },
        // Data Visualization / Accents
        accent: {
          DEFAULT: '#8B5CF6', // Violet-500
          hover: '#7C3AED',   // Violet-600
          glow: 'rgba(139, 92, 246, 0.2)',
        },
        status: {
          success: '#10B981', // Emerald-500
          error: '#F43F5E',   // Rose-500
          warning: '#F59E0B', // Amber-500
          info: '#3B82F6',    // Blue-500
        },
        // Legacy mappings
        navy: {
          900: '#0F0F11',
          800: '#18181B',
          700: '#27272A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'San Francisco', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'lg': '12px',
        'xl': '12px',
        '2xl': '16px',
      },
      boxShadow: {
        'glow': '0 0 20px -5px rgba(139, 92, 246, 0.3)', // Violet glow
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'violet-fade': 'linear-gradient(to bottom, rgba(139,92,246,0.1) 0%, transparent 100%)',
      }
    },
  },
  plugins: [],
}
