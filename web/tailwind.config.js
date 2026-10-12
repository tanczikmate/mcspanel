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
        md: {
          surface: '#111215',
          surfaceDim: '#0C0D0F',
          surfaceBright: '#2A2B30',
          containerLowest: '#0E0F12',
          containerLow: '#16171B',
          container: '#1B1C22',
          containerHigh: '#23242A',
          containerHighest: '#2C2D35',
          outline: '#44474F',
          outlineVariant: '#2E3036',
          onSurface: '#E2E2E6',
          onSurfaceVariant: '#A4A7B2',
          primary: '#F0F0F2',
          onPrimary: '#111215'
        }
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        'md': '8px',
        'lg': '10px',
        'xl': '14px',
        '2xl': '18px',
        '3xl': '24px',
        'full': '9999px',
        // Harmonized aliases
        'md3-xs': '6px',
        'md3-sm': '8px',
        'md3-md': '10px',
        'md3-lg': '14px',
        'md3-xl': '18px',
        'md3-2xl': '18px',
        'md3-full': '9999px'
      }
    },
  },
  plugins: [],
}
