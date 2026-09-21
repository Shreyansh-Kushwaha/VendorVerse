import { useEffect, useRef, useState } from 'react';
import api from '../api.js';

// Render's free tier spins the backend down after inactivity, so the first
// request after a lull can take 30-60s to come back instead of failing fast.
// We only show anything once a check has been pending a beat, so a normal
// fast response never flickers this on.
const SHOW_DELAY_MS = 2000;
const RETRY_MS = 3000;
const HEALTHY_RECHECK_MS = 60000;
const REQUEST_TIMEOUT_MS = 15000;

// Cycles while we wait, in the voice of the "Stocked every morning" tagline —
// a cold start reads as the stall opening up, not as an error being retried.
const LINES = [
  { title: 'Waking up the server…', sub: 'Our backend is hosted on a free tier that sleeps when idle. This can take up to a minute.' },
  { title: 'Rolling up the shutters…', sub: 'Free hosting naps when nobody’s shopping — we’re opening the stall back up.' },
  { title: 'Restocking the shelves…', sub: 'Prices and stock are being dusted off. Almost ready.' },
  { title: 'Still on its way…', sub: 'Thanks for hanging on — this only happens after a quiet spell.' },
];
const LINE_MS = 4500;

export default function BackendWakeToast() {
  const [waking, setWaking] = useState(false);
  const [line, setLine] = useState(0);
  const lineTimer = useRef();

  useEffect(() => {
    let cancelled = false;
    let showTimer;
    let nextTimer;

    const check = async () => {
      let pending = true;
      showTimer = setTimeout(() => {
        if (pending && !cancelled) setWaking(true);
      }, SHOW_DELAY_MS);

      try {
        await api.get('/health', { timeout: REQUEST_TIMEOUT_MS });
        pending = false;
        clearTimeout(showTimer);
        if (cancelled) return;
        setWaking(false);
        nextTimer = setTimeout(check, HEALTHY_RECHECK_MS);
      } catch {
        pending = false;
        clearTimeout(showTimer);
        if (cancelled) return;
        setWaking(true);
        nextTimer = setTimeout(check, RETRY_MS);
      }
    };

    check();

    return () => {
      cancelled = true;
      clearTimeout(showTimer);
      clearTimeout(nextTimer);
    };
  }, []);

  // Cycle the copy only while actually waking, and start fresh each time a
  // new wait begins so it never reopens mid-sentence.
  useEffect(() => {
    if (!waking) {
      setLine(0);
      clearInterval(lineTimer.current);
      return;
    }
    lineTimer.current = setInterval(() => {
      setLine((i) => (i + 1) % LINES.length);
    }, LINE_MS);
    return () => clearInterval(lineTimer.current);
  }, [waking]);

  if (!waking) return null;

  const { title, sub } = LINES[line];

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[70] max-w-[calc(100vw-2rem)] sm:max-w-sm"
    >
      <div className="pointer-events-auto overflow-hidden rounded-lg border border-gray-200 bg-white shadow-pop dark:border-night-600 dark:bg-night-800">
        <div className="flex items-start gap-3 px-4 py-3 text-sm text-ink dark:text-gray-100">
          <Sprout className="mt-0.5 h-5 w-5 shrink-0 origin-bottom text-brand-600 motion-safe:animate-sprout dark:text-brand-400" />
          <span key={line} className="min-w-0 flex-1 motion-safe:animate-fade-in">
            <span className="block font-medium">{title}</span>
            <span className="block text-gray-500 dark:text-gray-400">{sub}</span>
          </span>
        </div>
        {/* Indeterminate — we don't know when the free-tier instance will be
            back, so the bar travels rather than fills to a percentage. */}
        <div className="relative h-1 w-full overflow-hidden bg-brand-100 dark:bg-night-700">
          <div className="absolute inset-y-0 w-1/3 rounded-full bg-brand-600 motion-safe:animate-wake-bar dark:bg-brand-400" />
        </div>
      </div>
    </div>
  );
}

function Sprout({ className = '' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 21v-8" />
      <path d="M12 13c0-4.5-3-7-7.5-7C4.5 10.5 7.5 13 12 13Z" />
      <path d="M12 11c0-3.5 2.5-6 6.5-6C18.5 9 15.5 11 12 11Z" />
    </svg>
  );
}
