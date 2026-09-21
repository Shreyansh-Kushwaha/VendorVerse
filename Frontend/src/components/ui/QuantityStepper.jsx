import { useEffect, useRef, useState } from 'react';
import { haptic } from '../../lib/haptics.js';

// 44px targets. Nobody buys one kilogram of onions, so quantity belongs at the
// point of adding rather than three screens later in the cart.
//
// The value slides up on + and down on −, so the number itself shows which way
// it moved; each step lands with a tick. At the stock ceiling the control
// shakes once and buzzes a warning instead of silently ignoring the tap.
export default function QuantityStepper({ value, onChange, unit = 'kg', max, min = 1, label }) {
  const clamp = (n) => {
    if (Number.isNaN(n)) return min;
    const capped = max != null ? Math.min(n, max) : n;
    return Math.max(min, capped);
  };
  const atMax = max != null && value >= max;

  // Keyed remount re-runs the bump animation reliably on every step.
  const [bump, setBump] = useState({ dir: null, n: 0 });
  const [shake, setShake] = useState(0);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const step = (delta) => {
    if (delta > 0 && atMax) {
      setShake((s) => s + 1);
      haptic('warning');
      timers.current.push(setTimeout(() => setShake(0), 900));
      return;
    }
    const next = clamp(value + delta);
    if (next === value) return;
    onChange(next);
    haptic('tick');
    setBump((b) => ({ dir: delta > 0 ? 'up' : 'down', n: b.n + 1 }));
  };

  const btn = 'grid h-11 w-9 place-items-center text-lg text-gray-600 transition-colors ' +
    'hover:bg-gray-50 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-inset focus-visible:ring-brand-600 dark:text-gray-300 dark:hover:bg-night-700 ' +
    'dark:focus-visible:ring-brand-400';

  return (
    <div
      key={shake ? `s${shake}` : undefined}
      className={'inline-flex h-11 items-center rounded-md border border-gray-200 dark:border-night-600 ' +
        (shake ? 'animate-shake border-amber-600/60 dark:border-amber-400/60' : '')}
    >
      <button
        type="button" className={`${btn} rounded-l-md`} disabled={value <= min}
        aria-label={`Decrease${label ? ` ${label}` : ''} quantity`}
        onClick={() => step(-1)}
      >&minus;</button>
      <label className="flex items-baseline">
        <span className="sr-only">{label ? `${label} quantity` : 'Quantity'}</span>
        <span key={bump.n} className={'overflow-hidden ' + (bump.dir === 'up' ? 'animate-bump-up' : bump.dir === 'down' ? 'animate-bump-down' : '')}>
          <input
            type="number" inputMode="numeric" min={min} max={max} value={value}
            onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))}
            className="tnum w-10 border-0 bg-transparent p-0 text-center text-sm text-ink focus:outline-none dark:text-gray-100"
          />
        </span>
        <span className="pr-1.5 text-xs text-gray-500 dark:text-gray-400">{unit}</span>
      </label>
      <button
        type="button" className={`${btn} rounded-r-md ${atMax ? 'opacity-30' : ''}`}
        aria-label={`Increase${label ? ` ${label}` : ''} quantity`}
        aria-disabled={atMax || undefined}
        onClick={() => step(1)}
      >+</button>
    </div>
  );
}
