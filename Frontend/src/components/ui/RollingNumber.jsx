const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// A formatted amount whose digits roll to their new value instead of blinking.
// Give it the already-formatted string (money(), amount()); non-digits render
// static. When the shape changes — a digit appears or disappears — the `key`
// remounts the whole thing so it swaps instantly rather than rolling garbage.
export default function RollingNumber({ value, className = '' }) {
  const text = String(value);
  const shape = [...text].map((c) => (/\d/.test(c) ? 'd' : c)).join('');

  return (
    <span key={shape} className={`odo ${className}`} role="text" aria-label={text}>
      {[...text].map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className="odo-col" aria-hidden>
            <span
              className="odo-strip"
              style={{ transform: `translateY(-${ch}em)`, transitionDelay: `${i * 30}ms` }}
            >
              {DIGITS.map((d) => <span key={d}>{d}</span>)}
            </span>
          </span>
        ) : (
          <span key={i} className="odo-ch" aria-hidden>{ch}</span>
        ),
      )}
    </span>
  );
}
