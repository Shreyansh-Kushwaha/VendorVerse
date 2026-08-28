import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useNotifications } from '../notifications.jsx';

const PAGE_SIZE = 30;

function timeAgo(iso) {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// The bell shows the last thirty; this page is the whole history. It keeps its
// own list so pagination can walk past the bell's window, and leans on the
// shared context for the actions so the badge stays honest everywhere.
export default function Notifications() {
  const navigate = useNavigate();
  const { unread, live, markRead, markAllRead, onNotification } = useNotifications();

  const [data, setData] = useState({ items: [], total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const { data: d } = await api.get('/notifications', { params: { page: p, limit: PAGE_SIZE } });
      setData((prev) => ({
        total: d.total,
        pages: d.pages,
        items: p === 1 ? d.items : [...prev.items, ...d.items],
      }));
    } catch { /* the empty state already says nothing arrived */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  // A notification arriving while the page is open joins the top of the list.
  useEffect(() => onNotification((note) => {
    setData((prev) => ({ ...prev, total: prev.total + 1, items: [note, ...prev.items] }));
  }), [onNotification]);

  const open = (note) => {
    if (!note.read) {
      markRead(note._id);
      setData((prev) => ({ ...prev, items: prev.items.map(n => (n._id === note._id ? { ...n, read: true } : n)) }));
    }
    if (note.orderId) navigate(`/orders/${note.orderId}`);
  };

  const readAll = () => {
    markAllRead();
    setData((prev) => ({ ...prev, items: prev.items.map(n => ({ ...n, read: true })) }));
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Everything that happened</p>
          <h1 className="flex items-center gap-2 text-2xl tracking-tight text-ink dark:text-gray-100 sm:text-3xl">
            Notifications
            <span
              title={live ? 'Live' : 'Reconnecting'}
              className={'h-2 w-2 rounded-full ' + (live ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-night-600')}
            />
          </h1>
        </div>
        {unread > 0 && (
          <button onClick={readAll} className="btn-ghost">
            Mark all {unread} read
          </button>
        )}
      </div>

      <div className="card mt-6 overflow-hidden">
        {loading && data.items.length === 0 ? (
          <div className="space-y-3 p-5">
            <div className="skel h-5 w-2/3" />
            <div className="skel h-5 w-1/2" />
            <div className="skel h-5 w-3/5" />
          </div>
        ) : data.items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Nothing yet. New orders and status changes land here.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-night-700">
            {data.items.map((n) => (
              <li key={n._id}>
                <button
                  onClick={() => open(n)}
                  className={'w-full px-4 py-3.5 text-left transition hover:bg-brand-50/60 dark:hover:bg-night-700/60 ' +
                    (n.read ? '' : 'bg-brand-50/40 dark:bg-night-700/40')}
                >
                  <div className="flex items-start gap-2.5">
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                    <div className={'min-w-0 flex-1 ' + (n.read ? 'pl-[18px]' : '')}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-ink dark:text-gray-100">{n.title}</span>
                        <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{timeAgo(n.createdAt)}</span>
                      </div>
                      {n.body && <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{n.body}</div>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {page < data.pages && (
        <div className="mt-4 text-center">
          <button onClick={() => setPage(p => p + 1)} disabled={loading} className="btn-ghost">
            {loading ? 'Loading…' : `Load older (${data.total - data.items.length} left)`}
          </button>
        </div>
      )}
    </div>
  );
}
