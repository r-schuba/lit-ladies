/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf6f0',
          100: '#fae8de',
          200: '#f5c9b3',
          300: '#eca884',
          400: '#df8256',
          500: '#C4614A',
          600: '#a84f3c',
          700: '#8c3e2e',
          800: '#732f22',
          900: '#5e2219',
        },
        cream: {
          50: '#FFFAF6',
          100: '#FDF6EE',
          200: '#F5EBE0',
          300: '#EDD9C8',
        },
      },
    },
  },
  plugins: [],
};
