const Star = ({ filled, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
  </svg>
);

// Read-only star row. The number is the content; the stars are decoration.
export default function Stars({ value, count, size = 13, className = '' }) {
  if (value == null) return null;
  return (
    <span className={'inline-flex items-center gap-1 text-amber-500 dark:text-amber-400 ' + className}>
      <span className="inline-flex" role="img" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} filled={value >= i - 0.5} />)}
      </span>
      <span className="tnum text-gray-600 dark:text-gray-400">
        {value}{count != null && ` (${count})`}
      </span>
    </span>
  );
}

// Tappable version for leaving a rating.
export function RatingInput({ value, onChange, size = 26 }) {
  return (
    <div className="flex gap-1 text-amber-500 dark:text-amber-400" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i === 1 ? '' : 's'}`}
          onClick={() => onChange(i)}
          className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400"
        >
          <Star size={size} filled={value >= i} />
        </button>
      ))}
    </div>
  );
}
