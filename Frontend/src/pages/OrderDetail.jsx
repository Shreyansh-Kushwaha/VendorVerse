import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { haptic } from '../lib/haptics.js';
import { reorderLine } from '../lib/reorder.js';
import api from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useToast } from '../components/Toast.jsx';
import { useNotifications } from '../notifications.jsx';
import Modal from '../components/Modal.jsx';
import { money, perUnit, amount } from '../format.js';
import StatusPill from '../components/ui/StatusPill.jsx';

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
  const { user } = useAuth();
  const toast = useToast();
  const { onNotification } = useNotifications();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const cart = useCart();
  const [reordering, setReordering] = useState(false);

  // Motion happens only at the moment of change: when an SSE update advances
  // the status, the newly reached dot pops and its check draws in. Steps that
  // were already reached when the page loaded render settled and still.
  const prevIdx = useRef(null);
  const [advanced, setAdvanced] = useState(false);
  const status0 = order?.status || 'Pending';
  useEffect(() => {
    if (!order) return;
    const idx = FLOW.indexOf(status0);
    if (prevIdx.current !== null && idx > prevIdx.current) {
      setAdvanced(true);
      haptic('medium');
    }
    prevIdx.current = idx;
  }, [order, status0]);

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data);
    } catch (err) {
      if (!quiet) toast.error(err.response?.data?.msg || 'Order not found');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  // The supplier moving this order along shows up here without a refresh.
  useEffect(
    () => onNotification((n) => { if (String(n.orderId) === String(id)) load({ quiet: true }); }),
    [onNotification, id, load],
  );

  const cancelOrder = async () => {
    setCancelling(true);
    try {
      const { data } = await api.post(`/orders/${id}/cancel`);
      setOrder((o) => ({ ...o, ...data.order }));
      setConfirmCancel(false);
      toast.success('Order cancelled');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not cancel this order');
    } finally {
      setCancelling(false);
    }
  };

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

  const isBuyer = String(order.vendorId?._id || order.vendorId) === String(user?._id);
  const canCancel = isBuyer && status === 'Pending';

  const reorder = async () => {
    setReordering(true);
    try {
      const { qty, item, priceChanged } = await reorderLine(order, cart);
      haptic('tick');
      toast.success(
        `${amount(qty, item.unit)} ${item.itemName} added at ${perUnit(item.price, item.unit)}` +
        (priceChanged ? ` (was ${perUnit(order.price, order.unit)})` : ''),
      );
    } catch (err) {
      toast.error(err.message || 'Could not reorder this item');
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Order #{order._id.slice(-6).toUpperCase()}</p>
          <h1 className="font-display text-3xl text-ink dark:text-gray-100">{order.itemName}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {amount(order.quantity, order.unit)} × {perUnit(order.price, order.unit)} • placed {new Date(order.date).toLocaleString()}
          </p>
        </div>
        <StatusPill status={status} wide />
      </div>

      {canCancel && (
        <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The supplier has not accepted this order yet, so you can still call it off.
          </p>
          <button className="btn-danger shrink-0" onClick={() => setConfirmCancel(true)}>Cancel order</button>
        </div>
      )}

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
                    <span className={'absolute left-3 top-6 bottom-0 w-px ' + (idx < currentIdx ? 'bg-brand-600 dark:bg-brand-500' : 'bg-gray-200 dark:bg-night-600')} />
                  )}
                  <span
                    aria-current={isCurrent ? 'step' : undefined}
                    className={
                      'relative grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors duration-200 ' +
                      (reached
                        ? 'bg-brand-600 text-white dark:bg-brand-500'
                        : 'bg-gray-100 text-gray-400 dark:bg-night-700 dark:text-gray-500') +
                      (isCurrent ? ' ring-2 ring-brand-600 ring-offset-2 dark:ring-gray-100 dark:ring-offset-night-800' : '') +
                      (isCurrent && advanced ? ' animate-pop' : '')
                    }
                  >
                    {reached ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path className={isCurrent && advanced ? 'tick-draw' : ''} d="M5 12l5 5L20 7"/>
                      </svg>
                    ) : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
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
        <h2 className="font-display text-xl text-ink dark:text-gray-100 mb-3">Delivery</h2>
        <div className="text-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Address</div>
          <p className="text-ink dark:text-gray-100 mt-0.5">{order.deliveryAddress || '—'}</p>
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-3">Preferred window</div>
          <p className="text-ink dark:text-gray-100 mt-0.5">{order.deliverySlot || 'Anytime'}</p>
          {order.notes && (
            <>
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-3">Notes for the supplier</div>
              <p className="text-gray-700 dark:text-gray-300 mt-0.5 whitespace-pre-wrap">{order.notes}</p>
            </>
          )}
        </div>
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
          <span className="text-gray-600 dark:text-gray-400">{order.itemName} · {amount(order.quantity, order.unit)}</span>
          <span className="tnum text-2xl font-medium tracking-tight text-ink dark:text-gray-100">{money(order.quantity * order.price)}</span>
        </div>
        {isBuyer && (
          <button className="btn-ghost w-full mt-4" onClick={reorder} disabled={reordering}>
            {reordering ? 'Adding…' : 'Order this again'}
          </button>
        )}
      </section>
      <Modal
        open={confirmCancel}
        onClose={() => !cancelling && setConfirmCancel(false)}
        title="Cancel this order?"
        size="sm"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmCancel(false)} disabled={cancelling}>Keep it</button>
            <button className="btn-danger" onClick={cancelOrder} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Yes, cancel'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {order.itemName} · {amount(order.quantity, order.unit)} from {order.supplierId?.name || 'this supplier'} will
          be called off and the stock returned. You cannot undo this.
        </p>
      </Modal>
    </div>
  );
}

function Party({ title, name, location, email }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-night-700 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</div>
      <div className={'font-medium mt-0.5 ' + (name ? 'text-ink dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 italic')}>
        {name || 'Deleted account'}
      </div>
      {location && <div className="text-sm text-gray-600 dark:text-gray-400">{location}</div>}
      {email && <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate">{email}</div>}
    </div>
  );
}
