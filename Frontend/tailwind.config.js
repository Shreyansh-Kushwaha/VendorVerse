/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // A warm stone ramp, not a neutral one. Every text-gray-* in the app
        // picks up a trace of the brand hue, which is what stops a page made
        // almost entirely of text and rules from reading like a printout.
        gray: {
          50:  '#FAF9F8',
          100: '#F5F3F1',
          200: '#E8E4E0',
          300: '#D6D1CC',
          400: '#A8A29E', // decorative and disabled only — 2.52:1 on white
          500: '#736C66', // 5.05:1 on white, 4.80:1 on the warm ground
          600: '#57534E', // 7.63:1
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
        },
        // Terracotta. Warm enough to read as a trade/produce brand rather than
        // a SaaS one, and dark enough that it never collides with the amber
        // Pending dot. 50–200 are real tints again, so the hover and unread
        // states that already reference them light up without a call-site edit.
        brand: {
          50:  '#FEF6F2',
          100: '#FBE8DE',
          200: '#F6CDB8',
          300: '#FDBA74', // dark-mode accent text — 10.5:1 on night-800
          400: '#FB923C', // dark-mode accent text — 7.9:1 on night-800
          500: '#C2410C', // fills on dark — white on it is 5.18:1
          600: '#C2410C', // the action colour — white on it is 5.18:1
          700: '#9A3412', // hover, and accent text on light — 7.31:1
          800: '#7C2D12',
          900: '#601E0C',
        },
        // The page ground sits just below white so that cards, which stay pure
        // white, lift off it by value as well as by their border.
        cream: '#FAF8F5',
        ink:   '#1C1614', // warm near-black — 17.0:1 on the ground
        night: {
          950: '#0A0806',
          900: '#12100E', // body bg
          800: '#1B1816', // surface
          700: '#241F1C', // raised
          600: '#2E2926', // border
          500: '#3D3733', // strong border
          400: '#5A514C', // resting scrollbar thumb — 2.46:1 on night-900
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
        pop:  '0 1px 2px rgba(28,22,20,0.04), 0 12px 32px -12px rgba(28,22,20,0.20)',
      },
      letterSpacing: {
        tight:   '-0.014em',
        tighter: '-0.028em',
      },
      // Four curves carry all motion. Out-quart is the default for anything that
      // appears or settles; spring overshoots and is reserved for small
      // celebratory pops; sheet is the fast-launch soft-landing modal feel;
      // move is symmetric, for indicators travelling between two resting places.
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        spring:      'cubic-bezier(0.34, 1.56, 0.64, 1)',
        sheet:       'cubic-bezier(0.32, 0.72, 0, 1)',
        move:        'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      keyframes: {
        rise:       { from: { opacity: '0', transform: 'translateY(5px)' }, to: { opacity: '1', transform: 'none' } },
        pop:        { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.3)' }, '100%': { transform: 'scale(1)' } },
        shake:      { '20%, 60%': { transform: 'translateX(-3px)' }, '40%, 80%': { transform: 'translateX(3px)' } },
        'bump-up':   { from: { opacity: '0', transform: 'translateY(45%)' }, to: { opacity: '1', transform: 'none' } },
        'bump-down': { from: { opacity: '0', transform: 'translateY(-45%)' }, to: { opacity: '1', transform: 'none' } },
        'toast-in': { from: { opacity: '0', transform: 'translateY(10px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in':  { from: { opacity: '0' }, to: { opacity: '1' } },
        'modal-in': { from: { opacity: '0', transform: 'translateY(8px) scale(0.97)' }, to: { opacity: '1', transform: 'none' } },
        'sheet-in': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        shimmer:    { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
      animation: {
        rise:       'rise 260ms cubic-bezier(0.25, 1, 0.5, 1) both',
        pop:        'pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        shake:      'shake 280ms ease-in-out',
        'bump-up':   'bump-up 200ms cubic-bezier(0.25, 1, 0.5, 1)',
        'bump-down': 'bump-down 200ms cubic-bezier(0.25, 1, 0.5, 1)',
        'toast-in': 'toast-in 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'fade-in':  'fade-in 260ms ease-out both',
        'modal-in': 'modal-in 260ms cubic-bezier(0.25, 1, 0.5, 1) both',
        'sheet-in': 'sheet-in 340ms cubic-bezier(0.32, 0.72, 0, 1) both',
        shimmer:    'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
