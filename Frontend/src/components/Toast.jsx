import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { haptic } from '../lib/haptics.js';

const ToastContext = createContext(null);

// Successes get out of the way on their own. Errors do not — a message that
// vanishes in three seconds is the same as no message for anyone who looked away.
const AUTO_DISMISS = { success: 4000, info: 4000, error: null };

const DOT = {
  success: 'bg-emerald-600',
  error:   'bg-red-600',
  info:    'bg-gray-400',
};

// Long enough for the row collapse below to finish before the node unmounts.
const EXIT_MS = 240;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const exitTimers = useRef({});

  const dismiss = useCallback((id) => {
    // Mark it leaving so the row can animate to 0fr, then actually remove it.
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    clearTimeout(exitTimers.current[id]);
    exitTimers.current[id] = setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      delete exitTimers.current[id];
    }, EXIT_MS);
  }, []);

  const push = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    if (type === 'success' || type === 'error') haptic(type);
    const ttl = AUTO_DISMISS[type];
    if (ttl) setTimeout(() => dismiss(id), ttl);
  }, [dismiss]);

  // Stable identity — OrderDetail and SupplierProfile list this in useEffect deps.
  const toast = useMemo(() => ({
    success: (m) => push(m, 'success'),
    error:   (m) => push(m, 'error'),
    info:    (m) => push(m, 'info'),
  }), [push]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Bottom on phones, where it clears the header and sits near the thumb. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:w-80">
        {toasts.map((t) => (
          // Each toast sits in a grid row that collapses 1fr → 0fr on exit, so
          // the rest of the stack reflows smoothly instead of snapping up.
          <div
            key={t.id}
            className={'grid transition-[grid-template-rows] duration-200 ease-out-quart ' +
              (t.leaving ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}
          >
            <div className="min-h-0 overflow-hidden">
              <div
                role={t.type === 'error' ? 'alert' : 'status'}
                aria-live={t.type === 'error' ? 'assertive' : 'polite'}
                className={'pointer-events-auto mt-2 flex items-start gap-2.5 rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-sm text-ink shadow-pop transition-[opacity,transform] duration-200 animate-toast-in dark:border-night-600 dark:bg-night-800 dark:text-gray-100 ' +
                  (t.leaving ? 'translate-y-1 opacity-0' : '')}
              >
                <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[t.type] || DOT.info}`} />
                <span className="min-w-0 flex-1">{t.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="-m-1 shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:hover:text-gray-100 dark:focus-visible:ring-brand-400"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
