import { useEffect, useState } from 'react';
import api from '../api.js';

// Render's free tier spins the backend down after inactivity, so the first
// request after a lull can take 30-60s to come back instead of failing fast.
// We only show anything once a check has been pending a beat, so a normal
// fast response never flickers this on.
const SHOW_DELAY_MS = 2000;
const RETRY_MS = 3000;
const HEALTHY_RECHECK_MS = 60000;
const REQUEST_TIMEOUT_MS = 15000;

export default function BackendWakeToast() {
  const [waking, setWaking] = useState(false);

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

  if (!waking) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[70] max-w-[calc(100vw-2rem)] sm:max-w-sm"
    >
      <div className="pointer-events-auto flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-ink shadow-pop dark:border-night-600 dark:bg-night-800 dark:text-gray-100">
        <span
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand-600 border-t-transparent dark:border-brand-400"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Waking up the server…</span>
          <span className="block text-gray-500 dark:text-gray-400">
            Our backend is hosted on a free tier that sleeps when idle. This can take up to a minute.
          </span>
        </span>
      </div>
    </div>
  );
}
