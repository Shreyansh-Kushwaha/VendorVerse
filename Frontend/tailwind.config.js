/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Tailwind's stock grey is blue-tinted. A neutral ramp is what makes the
        // whole app read cool-white rather than slightly cold-blue, and every
        // existing text-gray-* usage picks it up without an edit.
        gray: {
          50:  '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3', // decorative and disabled only — 2.52:1 on white
          500: '#737373', // 4.74:1
          600: '#525252', // 7.81:1
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
        // Demoted from "the button colour" to a restrained accent. 50–200 are
        // neutral so the hover tints that reference them read grey, not orange.
        brand: {
          50:  '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#FDBA74', // dark-mode accent text
          400: '#FB923C', // dark-mode accent text — 8.14:1 on night-800
          500: '#C2410C', // accent — 5.18:1 on white
          600: '#C2410C',
          700: '#9A3412',
          800: '#7C2D12',
          900: '#601E0C',
        },
        cream: '#FFFFFF', // the page ground is plain white now
        ink:   '#0A0A0A', // 19.8:1 on white
        night: {
          950: '#000000',
          900: '#0A0A0A', // body bg
          800: '#141414', // surface
          700: '#1C1C1C', // raised
          600: '#262626', // border
          500: '#333333', // strong border
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        // Kept as an alias so the 60 existing font-display usages resolve to the
        // UI face instead of a serif. Remove the class as pages get reworked.
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl:   '8px',  // was 12px
        '2xl': '10px', // was 16px
      },
      boxShadow: {
        // Separation is a 1px border now. Only genuinely floating surfaces lift.
        card: 'none',
        pop:  '0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(0,0,0,0.18)',
      },
      letterSpacing: {
        tight:   '-0.014em',
        tighter: '-0.028em',
      },
    },
  },
  plugins: [],
};
