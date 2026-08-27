import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

// Successes get out of the way on their own. Errors do not — a message that
// vanishes in three seconds is the same as no message for anyone who looked away.
const AUTO_DISMISS = { success: 4000, info: 4000, error: null };

const DOT = {
  success: 'bg-emerald-600',
  error:   'bg-red-600',
  info:    'bg-gray-400',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
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
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            aria-live={t.type === 'error' ? 'assertive' : 'polite'}
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-sm text-ink shadow-pop dark:border-night-600 dark:bg-night-800 dark:text-gray-100"
          >
            <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[t.type] || DOT.info}`} />
            <span className="min-w-0 flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-m-1 shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink dark:hover:text-gray-100 dark:focus-visible:ring-gray-100"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
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
