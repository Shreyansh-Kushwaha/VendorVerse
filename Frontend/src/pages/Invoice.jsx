import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api.js';
import { money, perUnit, amount } from '../format.js';
import usePageMeta from '../lib/meta.js';

// The paper trail the order pitch promises. Deliberately printed in document
// colours — white paper, dark ink — whatever theme the app is in, so what the
// screen shows is exactly what the printer produces.
export default function Invoice() {
  usePageMeta({
    title: 'Invoice',
    description:
      'A printable invoice for this order.',
    noIndex: true,
  });
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    api.get(`/orders/${id}`)
      .then(({ data }) => { if (on) setOrder(data); })
      .catch(() => {})
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [id]);

  // Lets print CSS strip the app chrome around the sheet.
  useEffect(() => {
    document.body.classList.add('invoice-mode');
    return () => document.body.classList.remove('invoice-mode');
  }, []);

  if (loading) {
    return <InvoiceSkeleton />;
  }
  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
        <h1 className="font-display text-2xl text-ink dark:text-gray-100">Order not found</h1>
        <Link to="/orders" className="btn-primary mt-4">Back to orders</Link>
      </div>
    );
  }

  const total = (order.quantity || 0) * (order.price || 0);
  const deliveredAt = order.statusHistory?.find(h => h.status === 'Delivered')?.at;
  const number = order._id.slice(-6).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/orders/${id}`} className="btn-ghost">← Back to order</Link>
        <button className="btn-primary" onClick={() => window.print()}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" />
          </svg>
          Print or save PDF
        </button>
      </div>

      <div className="invoice-sheet rounded-xl border border-gray-200 bg-white p-8 text-gray-900 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xl font-semibold tracking-tight">VendorVerse</div>
            <div className="text-xs text-gray-500">vendorverse — raw materials, delivered</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tracking-tight">
              {order.status === 'Delivered' ? 'Invoice' : 'Order summary'}
            </div>
            <div className="tnum text-sm text-gray-500">#{number}</div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">From (supplier)</div>
            <div className="mt-1 font-medium">{order.supplierId?.name || 'Deleted account'}</div>
            {order.supplierId?.location && <div className="text-gray-600">{order.supplierId.location}</div>}
            {order.supplierId?.email && <div className="text-gray-600">{order.supplierId.email}</div>}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Billed to (vendor)</div>
            <div className="mt-1 font-medium">{order.vendorId?.name || 'Deleted account'}</div>
            <div className="text-gray-600">{order.deliveryAddress}</div>
            {order.vendorId?.email && <div className="text-gray-600">{order.vendorId.email}</div>}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Placed</div>
            <div className="mt-0.5">{new Date(order.date).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">{deliveredAt ? 'Delivered' : 'Status'}</div>
            <div className="mt-0.5">{deliveredAt ? new Date(deliveredAt).toLocaleDateString() : order.status}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Window</div>
            <div className="mt-0.5">{order.deliverySlot || 'Anytime'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Payment</div>
            <div className="mt-0.5">Cash on delivery</div>
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Rate</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-3">{order.itemName}</td>
              <td className="tnum py-3 text-right">{amount(order.quantity, order.unit)}</td>
              <td className="tnum py-3 text-right">{perUnit(order.price, order.unit)}</td>
              <td className="tnum py-3 text-right">{money(total)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="3" className="py-3 text-right font-medium">Total</td>
              <td className="tnum py-3 text-right text-lg font-semibold">{money(total)}</td>
            </tr>
          </tfoot>
        </table>

        {order.notes && (
          <div className="mt-4 text-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">Notes</div>
            <p className="mt-0.5 whitespace-pre-wrap text-gray-700">{order.notes}</p>
          </div>
        )}

        <p className="mt-8 border-t border-gray-100 pt-4 text-xs text-gray-500">
          Generated by VendorVerse on {new Date().toLocaleDateString()} · order
          reference {order._id} · settled in cash between vendor and supplier on delivery.
        </p>
      </div>
    </div>
  );
}

// Stands in for the invoice sheet: masthead, the two address blocks, then the
// line-item table.
function InvoiceSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" role="status" aria-live="polite">
      <span className="sr-only">Loading invoice…</span>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="skel h-7 w-36" />
          <div className="skel h-4 w-24" />
        </div>
        <div className="skel h-11 w-28 rounded-md" />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="skel h-3 w-16" />
            <div className="skel h-4 w-32 max-w-full" />
            <div className="skel h-4 w-24 max-w-full" />
          </div>
        ))}
      </div>
      <div className="mt-8 space-y-2">
        <div className="skel h-4 w-full" />
        {[1, 2, 3].map((i) => <div key={i} className="skel h-10 w-full" />)}
      </div>
      <div className="mt-6 flex justify-end">
        <div className="skel h-6 w-40" />
      </div>
    </div>
  );
}
