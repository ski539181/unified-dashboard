/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0a0b',
        'bg-secondary': '#111113',
        'bg-card': '#1a1a1c',
        'text-primary': '#f5f5f7',
        'text-secondary': '#a1a1a6',
        'accent': '#6c5ce7',
        'accent-light': '#a29bfe',
        'success': '#00d2d3',
        'warning': '#feca57',
        'error': '#ff6b6b',
      },
    },
  },
  plugins: [],
}
