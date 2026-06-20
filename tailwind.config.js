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
        slate: {
          800: '#2c394f', // Brighter slate-800 for buttons/pills
          900: '#1d283c', // Brighter slate-900 for dark mode cards/header/sidebar (was #182235)
          950: '#0b101b', // Slightly brighter page background
        },
        enterprise: {
          50: '#f3f7fb',
          100: '#e0eaf5',
          200: '#c1d6ec',
          300: '#a3c2e1',
          400: '#84add7',
          500: '#6699cc',
          600: '#4b7fae',
          700: '#39668f',
          800: '#2a4e70',
          900: '#1c354e',
          950: '#0f1f2f',
        }
      }
    },
  },
  plugins: [],
}
