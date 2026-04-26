import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api.js';
import { useToast } from '../components/Toast.jsx';

const FLOW = ['Pending', 'Accepted', 'Packed', 'OutForDelivery', 'Delivered'];
const FLOW_LABELS = {
  Pending: 'Placed',
  Accepted: 'Accepted',
  Packed: 'Packed',
  OutForDelivery: 'Out for delivery',
  Delivered: 'Delivered',
};

export default function OrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/orders/${id}`);
        if (!cancelled) setOrder(data);
      } catch (err) {
        if (!cancelled) toast.error(err.response?.data?.msg || 'Order not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, toast]);

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-gray-500 dark:text-gray-400">Loading order…</div>;
  }
  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
        <h1 className="font-display text-2xl text-ink dark:text-gray-100">Order not found</h1>
        <Link to="/vendor" className="btn-primary mt-4">Back to dashboard</Link>
      </div>
    );
  }

  const status = order.status || 'Pending';
  const isTerminalReject = status === 'Rejected' || status === 'Cancelled';
  const currentIdx = isTerminalReject ? -1 : FLOW.indexOf(status);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Order #{order._id.slice(-6).toUpperCase()}</p>
          <h1 className="font-display text-3xl text-ink dark:text-gray-100">{order.itemName}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {order.quantity} × ₹{order.price} • placed {new Date(order.date).toLocaleString()}
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      {/* Timeline */}
      <section className="card p-5">
        <h2 className="font-display text-xl text-ink dark:text-gray-100 mb-4">Status</h2>
        {isTerminalReject ? (
          <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/30 p-4 text-red-700 dark:text-red-300 text-sm">
            This order was {status.toLowerCase()}.
          </div>
        ) : (
          <ol className="relative">
            {FLOW.map((step, idx) => {
              const reached = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              const at = order.statusHistory?.find(h => h.status === step)?.at;
              return (
                <li key={step} className="flex gap-3 pb-5 last:pb-0 relative">
                  {idx < FLOW.length - 1 && (
                    <span className={'absolute left-3 top-6 bottom-0 w-px ' + (idx < currentIdx ? 'bg-brand-500' : 'bg-gray-200 dark:bg-night-600')} />
                  )}
                  <span className={
                    'relative h-6 w-6 rounded-full grid place-items-center shrink-0 transition ' +
                    (reached
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-100 text-gray-400 dark:bg-night-700 dark:text-gray-500')
                  }>
                    {reached ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
                    ) : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    {isCurrent && <span className="absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-40 animate-ping" />}
                  </span>
                  <div className="flex-1 -mt-0.5">
                    <div className={'font-medium ' + (reached ? 'text-ink dark:text-gray-100' : 'text-gray-400 dark:text-gray-500')}>{FLOW_LABELS[step]}</div>
                    {at && <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(at).toLocaleString()}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-display text-xl text-ink dark:text-gray-100 mb-3">Parties</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <Party title="Supplier" name={order.supplierId?.name} location={order.supplierId?.location} email={order.supplierId?.email} />
          <Party title="Vendor" name={order.vendorId?.name} location={order.vendorId?.location} email={order.vendorId?.email} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-xl text-ink dark:text-gray-100 mb-3">Total</h2>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">{order.itemName} × {order.quantity}</span>
          <span className="font-display text-2xl text-brand-700 dark:text-brand-400">₹{order.quantity * order.price}</span>
        </div>
      </section>
    </div>
  );
}

function Party({ title, name, location, email }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-night-700 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</div>
      <div className="font-medium text-ink dark:text-gray-100 mt-0.5">{name || '—'}</div>
      {location && <div className="text-sm text-gray-600 dark:text-gray-400">{location}</div>}
      {email && <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate">{email}</div>}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    Pending:        'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    Accepted:       'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
    Packed:         'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300',
    OutForDelivery: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
    Delivered:      'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    Rejected:       'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    Cancelled:      'bg-gray-100 text-gray-700 dark:bg-night-700 dark:text-gray-300',
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-medium ${map[status] || ''}`}>{status}</span>;
}
