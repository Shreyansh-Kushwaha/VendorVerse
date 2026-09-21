import { useLayoutEffect, useRef, useState } from 'react';

// Underlined tabs whose indicator physically slides between them, so switching
// reads as movement along one rail rather than a blink. Badge counts arrive
// after data loads and change tab widths, so the bar re-measures on resize.
export default function Tabs({ tabs, value, onChange, label }) {
  const wrapRef = useRef(null);
  const [bar, setBar] = useState(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const el = wrap?.querySelector(`[data-tab="${value}"]`);
    if (!el) return;
    const measure = () => setBar({ left: el.offsetLeft, width: el.offsetWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [value, tabs]);

  return (
    <div
      ref={wrapRef}
      role="tablist"
      aria-label={label}
      className="relative flex gap-1 border-b border-gray-200 dark:border-night-600"
    >
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            data-tab={t.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={'px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400 ' +
              (on
                ? 'font-medium text-brand-700 dark:text-brand-300'
                : 'text-gray-500 hover:text-ink dark:text-gray-400 dark:hover:text-gray-100')}
          >
            {t.label}
            {t.badge > 0 && <span className="tnum ml-1.5 text-gray-400">{t.badge}</span>}
          </button>
        );
      })}
      {bar && (
        <span
          aria-hidden
          className="absolute -bottom-px left-0 h-0.5 bg-brand-600 transition-[transform,width] duration-200 ease-move dark:bg-brand-400"
          style={{ width: bar.width, transform: `translateX(${bar.left}px)` }}
        />
      )}
    </div>
  );
}
