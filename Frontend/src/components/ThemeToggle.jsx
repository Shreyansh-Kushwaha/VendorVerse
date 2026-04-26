import { useTheme } from '../theme.jsx';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={
        'relative inline-flex h-9 w-16 items-center rounded-full p-1 transition-colors duration-300 ' +
        'focus:outline-none focus:ring-2 focus:ring-brand-500/60 ' +
        (isDark
          ? 'bg-night-700 ring-1 ring-night-600'
          : 'bg-brand-100') +
        ' ' + className
      }
    >
      {/* Track icons */}
      <Sun
        className={
          'absolute left-2 h-4 w-4 transition-all duration-300 ' +
          (isDark ? 'opacity-30 scale-90 text-amber-200' : 'opacity-100 scale-100 text-brand-600')
        }
      />
      <Moon
        className={
          'absolute right-2 h-4 w-4 transition-all duration-300 ' +
          (isDark ? 'opacity-100 scale-100 text-brand-300' : 'opacity-30 scale-90 text-brand-700')
        }
      />

      {/* Sliding knob */}
      <span
        aria-hidden
        className={
          'relative z-10 grid h-7 w-7 place-items-center rounded-full bg-white shadow-pop ' +
          'transition-transform duration-300 ease-[cubic-bezier(.4,1.4,.6,1)] ' +
          (isDark ? 'translate-x-7' : 'translate-x-0')
        }
      >
        <span
          className={
            'transition-all duration-300 ' +
            (isDark ? 'rotate-0 scale-100' : '-rotate-90 scale-0')
          }
          style={{ position: 'absolute' }}
        >
          <Moon className="h-4 w-4 text-brand-600" />
        </span>
        <span
          className={
            'transition-all duration-300 ' +
            (isDark ? 'rotate-90 scale-0' : 'rotate-0 scale-100')
          }
          style={{ position: 'absolute' }}
        >
          <Sun className="h-4 w-4 text-brand-600" />
        </span>
      </span>
    </button>
  );
}

function Sun({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function Moon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  );
}
