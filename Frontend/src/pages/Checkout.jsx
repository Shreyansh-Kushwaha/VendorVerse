import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Checkout() {
  const { user } = useAuth();
  const { items, count, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const toast = useToast();
  const [address, setAddress] = useState(user?.location || '');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);

  // Group cart items by supplier so the user understands they're placing N orders to N suppliers
  const bySupplier = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      const k = it.supplierId;
      if (!m.has(k)) m.set(k, { supplierName: it.supplierName, items: [], total: 0 });
      const e = m.get(k);
      e.items.push(it);
      e.total += it.price * it.quantity;
    }
    return Array.from(m.entries());
  }, [items]);

  const placeOrders = async () => {
    if (!user || items.length === 0) return;
    setPlacing(true);
    try {
      const payload = {
        items: items.map(it => ({
          vendorId: user._id,
          supplierId: it.supplierId,
          itemId: it.itemId,
          itemName: it.itemName,
          quantity: it.quantity,
          price: it.price,
        })),
      };
      const { data } = await api.post('/placeOrders', payload);
      toast.success(`Placed ${data.count} order${data.count === 1 ? '' : 's'}`);
      clear();
      navigate('/vendor');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to place orders');
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="font-display text-3xl text-ink dark:text-gray-100">Nothing to checkout</h1>
        <Link to="/vendor" className="btn-primary mt-6">Browse items</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 grid lg:grid-cols-[1fr_320px] gap-6">
      <section className="space-y-6">
        <div>
          <h1 className="font-display text-3xl text-ink dark:text-gray-100">Checkout</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            You're placing {bySupplier.length} order{bySupplier.length === 1 ? '' : 's'} across {bySupplier.length} supplier{bySupplier.length === 1 ? '' : 's'}.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-xl text-ink dark:text-gray-100 mb-3">Delivery details</h2>
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="address">Delivery address</label>
              <input id="address" className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Stall address or landmark" />
            </div>
            <div>
              <label className="label" htmlFor="notes">Notes for the supplier (optional)</label>
              <textarea id="notes" className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. ring the bell, deliver before 8 AM" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Payment is on delivery for now. Online payments coming soon.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {bySupplier.map(([sid, group]) => (
            <div key={sid} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-ink dark:text-gray-100">{group.supplierName}</div>
                <div className="text-brand-700 dark:text-brand-400 font-semibold">₹{group.total}</div>
              </div>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                {group.items.map((it) => (
                  <li key={it.itemId} className="flex justify-between">
                    <span>{it.itemName} × {it.quantity}</span>
                    <span>₹{it.price * it.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <aside className="card p-5 h-fit lg:sticky lg:top-20">
        <h2 className="font-display text-xl text-ink dark:text-gray-100 mb-4">Summary</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-700 dark:text-gray-300"><dt>Items</dt><dd>{count}</dd></div>
          <div className="flex justify-between text-gray-700 dark:text-gray-300"><dt>Subtotal</dt><dd>₹{subtotal}</dd></div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400"><dt>Delivery</dt><dd>Free</dd></div>
        </dl>
        <div className="border-t border-gray-100 dark:border-night-700 my-4" />
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700 dark:text-gray-300">Total</span>
          <span className="font-display text-2xl text-brand-700 dark:text-brand-400">₹{subtotal}</span>
        </div>
        <button onClick={placeOrders} disabled={placing} className="btn-primary w-full mt-5">
          {placing ? 'Placing orders…' : `Place ${bySupplier.length} order${bySupplier.length === 1 ? '' : 's'}`}
        </button>
        <Link to="/cart" className="btn-ghost w-full mt-2">Back to cart</Link>
      </aside>
    </div>
  );
}
