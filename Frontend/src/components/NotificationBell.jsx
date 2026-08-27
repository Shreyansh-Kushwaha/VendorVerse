import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../notifications.jsx';

function timeAgo(iso) {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const { items, unread, live, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openNote = (note) => {
    if (!note.read) markRead(note._id);
    setOpen(false);
    if (note.orderId) navigate(`/orders/${note.orderId}`);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative inline-flex items-center justify-center h-10 w-10 rounded-xl text-gray-700 hover:bg-brand-50 dark:text-gray-300 dark:hover:bg-night-700 transition"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center ring-2 ring-white dark:ring-night-900">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] card overflow-hidden z-40">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-night-600 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink dark:text-gray-100">Notifications</span>
              <span
                title={live ? 'Live' : 'Reconnecting'}
                className={'h-1.5 w-1.5 rounded-full ' + (live ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-night-600')}
              />
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-700 dark:text-brand-300 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Nothing yet. New orders and status changes land here.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-night-700">
                {items.map((n) => (
                  <li key={n._id}>
                    <button
                      onClick={() => openNote(n)}
                      className={'w-full text-left px-4 py-3 transition hover:bg-brand-50/60 dark:hover:bg-night-700/60 ' +
                        (n.read ? '' : 'bg-brand-50/40 dark:bg-night-700/40')}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-500 shrink-0" />}
                        <div className={'min-w-0 ' + (n.read ? 'pl-4' : '')}>
                          <div className="text-sm font-medium text-ink dark:text-gray-100">{n.title}</div>
                          {n.body && <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{n.body}</div>}
                          <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{timeAgo(n.createdAt)}</div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
