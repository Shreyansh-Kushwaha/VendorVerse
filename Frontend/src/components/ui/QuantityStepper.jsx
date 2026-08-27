// 44px targets. Nobody buys one kilogram of onions, so quantity belongs at the
// point of adding rather than three screens later in the cart.
export default function QuantityStepper({ value, onChange, unit = 'kg', max, min = 1, label }) {
  const clamp = (n) => {
    if (Number.isNaN(n)) return min;
    const capped = max != null ? Math.min(n, max) : n;
    return Math.max(min, capped);
  };
  const atMax = max != null && value >= max;

  const btn = 'grid h-11 w-9 place-items-center text-lg text-gray-600 transition-colors ' +
    'hover:bg-gray-50 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-inset focus-visible:ring-ink dark:text-gray-300 dark:hover:bg-night-700 ' +
    'dark:focus-visible:ring-gray-100';

  return (
    <div className="inline-flex h-11 items-center rounded-md border border-gray-200 dark:border-night-600">
      <button
        type="button" className={`${btn} rounded-l-md`} disabled={value <= min}
        aria-label={`Decrease${label ? ` ${label}` : ''} quantity`}
        onClick={() => onChange(clamp(value - 1))}
      >&minus;</button>
      <label className="flex items-baseline">
        <span className="sr-only">{label ? `${label} quantity` : 'Quantity'}</span>
        <input
          type="number" inputMode="numeric" min={min} max={max} value={value}
          onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))}
          className="tnum w-10 border-0 bg-transparent p-0 text-center text-sm text-ink focus:outline-none dark:text-gray-100"
        />
        <span className="pr-1.5 text-xs text-gray-500 dark:text-gray-400">{unit}</span>
      </label>
      <button
        type="button" className={`${btn} rounded-r-md`} disabled={atMax}
        aria-label={`Increase${label ? ` ${label}` : ''} quantity`}
        onClick={() => onChange(clamp(value + 1))}
      >+</button>
    </div>
  );
}
