/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FFF5EC',
          100: '#FFE4CC',
          200: '#FFC899',
          300: '#FFAB66',
          400: '#FF8E40',
          500: '#FF8940', // primary
          600: '#FF7F11', // accent
          700: '#E97833',
          800: '#B85A1C',
          900: '#7A3A0F',
        },
        cream: '#FFF8F0',
        ink:   '#1F1F1F',
        night: {
          950: '#0B0907',
          900: '#13100D',  // body bg
          800: '#1C1814',  // surface
          700: '#272019',  // raised
          600: '#352B22',  // border
          500: '#4A3C30',  // muted border
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'serif'],
      },
      boxShadow: {
        card: '0 4px 14px rgba(0,0,0,0.08)',
        pop:  '0 10px 25px rgba(0,0,0,0.18)',
      },
    },
  },
  plugins: [],
};
