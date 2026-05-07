/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        carrot: {
          DEFAULT: '#ff7e36',
          dark: '#f96b1a',
          soft: '#fff3ec',
        },
      },
    },
  },
  plugins: [],
};
