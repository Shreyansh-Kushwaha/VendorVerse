import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { useNotifications } from '../notifications.jsx';
import { money, perUnit, amount } from '../format.js';
import StatusPill from '../components/ui/StatusPill.jsx';

// "Where is my delivery?" is a daily question. It used to live at the bottom of
// the dashboard, under a catalog that grows 24 rows at a time.
const VIEWS = {
  active:    { label: 'Active',    statuses: ['Pending', 'Accepted', 'Packed', 'OutForDelivery'] },
  delivered: { label: 'Delivered', statuses: ['Delivered'] },
  ended:     { label: 'Cancelled', statuses: ['Rejected', 'Cancelled'] },
};

const NEXT_UP = {
  Pending:        'Waiting for the supplier to accept',
  Accepted:       'The supplier is preparing your order',
  Packed:         'Packed — leaving for delivery next',
  OutForDelivery: 'On its way to you',
};

export default function Orders() {
  const toast = useToast();
  const { onNotification } = useNotifications();
  const [params, setParams] = useSearchParams();
  const view = VIEWS[params.get('view')] ? params.get('view') : 'active';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/vendor/orders');
      setOrders(data);
    } catch {
      toast.error('Could not load your orders');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  useEffect(() => onNotification(() => loadRef.current()), [onNotification]);

  const counts = useMemo(() => {
    const c = {};
    for (const key of Object.keys(VIEWS)) {
      c[key] = orders.filter(o => VIEWS[key].statuses.includes(o.status || 'Pending')).length;
    }
    return c;
  }, [orders]);

  // Grouped by day so a morning's restock reads as one trip, not eight rows.
  const days = useMemo(() => {
    const visible = orders.filter(o => VIEWS[view].statuses.includes(o.status || 'Pending'));
    const out = [];
    for (const o of visible) {
      const day = new Date(o.date).toDateString();
      const last = out[out.length - 1];
      if (last && last.day === day) last.rows.push(o);
      else out.push({ day, date: o.date, rows: [o] });
    }
    return out;
  }, [orders, view]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-2xl tracking-tight text-ink dark:text-gray-100 sm:text-3xl">Your orders</h1>

      <div role="tablist" aria-label="Order status" className="mt-5 flex gap-1 border-b border-gray-200 dark:border-night-600">
        {Object.entries(VIEWS).map(([key, v]) => {
          const on = key === view;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={on}
              onClick={() => setParams(key === 'active' ? {} : { view: key }, { replace: true })}
              className={'-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink dark:focus-visible:ring-gray-100 ' +
                (on
                  ? 'border-ink font-medium text-ink dark:border-gray-100 dark:text-gray-100'
                  : 'border-transparent text-gray-500 hover:text-ink dark:text-gray-400 dark:hover:text-gray-100')}
            >
              {v.label}
              {counts[key] > 0 && <span className="tnum ml-1.5 text-gray-400">{counts[key]}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="mt-6 animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-night-800" />)}
        </div>
      ) : days.length === 0 ? (
        <div className="card mt-6 p-10 text-center">
          <p className="text-ink dark:text-gray-100">
            {view === 'active' ? 'Nothing on its way' : `No ${VIEWS[view].label.toLowerCase()} orders`}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {view === 'active'
              ? 'Orders you place will show up here until they arrive.'
              : 'They will appear here once orders reach this state.'}
          </p>
          {view === 'active' && <Link to="/vendor" className="btn-ghost mt-5">Browse items</Link>}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {days.map(({ day, date, rows }) => (
            <section key={day}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {new Date(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
              </h2>
              <ul className="card divide-y divide-gray-200 dark:divide-night-600">
                {rows.map((o) => (
                  <li key={o._id}>
                    <Link
                      to={`/orders/${o._id}`}
                      className="flex flex-col gap-2 p-4 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink sm:flex-row sm:items-center sm:gap-4 dark:hover:bg-night-700/40 dark:focus-visible:ring-gray-100"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-ink dark:text-gray-100">{o.itemName}</div>
                        <div className="tnum truncate text-xs text-gray-500 dark:text-gray-400">
                          {amount(o.quantity, o.unit)} · {perUnit(o.price, o.unit)} · {o.supplierId?.name || 'Deleted account'}
                        </div>
                        {NEXT_UP[o.status || 'Pending'] && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{NEXT_UP[o.status || 'Pending']}</div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1">
                        <span className="tnum font-semibold text-ink dark:text-gray-100">
                          {money((o.quantity || 0) * (o.price || 0))}
                        </span>
                        <StatusPill status={o.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
