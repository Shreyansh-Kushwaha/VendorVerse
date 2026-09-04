import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useToast } from '../components/Toast.jsx';
import { money, amount, SLOTS } from '../format.js';
import { haptic } from '../lib/haptics.js';
import usePageMeta from '../lib/meta.js';

export default function Checkout() {
  usePageMeta({
    title: 'Checkout',
    description:
      'Confirm your delivery details and place your order.',
    noIndex: true,
  });
  const { user } = useAuth();
  const { items, count, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const toast = useToast();
  const [address, setAddress] = useState(user?.location || '');
  const [slot, setSlot] = useState(''); // '' = anytime
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(null); // { suppliers } — shows the confirmation moment
  const navTimer = useRef(null);
  useEffect(() => () => clearTimeout(navTimer.current), []);

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
        // Name and price are read off the live listing by the server — the cart
        // only says what and how much.
        items: items.map(it => ({
          supplierId: it.supplierId,
          itemId: it.itemId,
          quantity: it.quantity,
        })),
        deliveryAddress: address,
        deliverySlot: slot || undefined,
        notes,
      };
      await api.post('/placeOrders', payload);
      // This is the one earned celebration in the app — the moment money is
      // committed. A drawn check and a success buzz, then on to the orders.
      haptic('success');
      setPlaced({ suppliers: bySupplier.length });
      clear();
      navTimer.current = setTimeout(() => navigate('/orders'), 1800);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to place orders');
    } finally {
      setPlacing(false);
    }
  };

  if (placed) {
    return (
      <div className="fixed inset-0 z-40 grid place-items-center bg-cream dark:bg-night-900">
        <div className="text-center">
          <svg className="check-draw mx-auto" width="72" height="72" viewBox="0 0 72 72" aria-hidden>
            <circle className="cir" cx="36" cy="36" r="32" fill="none" strokeWidth="3" strokeLinecap="round"
              stroke="currentColor" style={{ color: '#047857' }} transform="rotate(-90 36 36)" />
            <path className="tick" d="M23 37.5l8.5 8.5L49 28.5" fill="none" strokeWidth="3.5"
              strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" style={{ color: '#047857' }} />
          </svg>
          <p className="animate-rise mt-5 text-lg font-medium text-ink dark:text-gray-100" style={{ animationDelay: '500ms' }}>
            Order placed with {placed.suppliers} supplier{placed.suppliers === 1 ? '' : 's'}
          </p>
          <p className="animate-rise mt-1 text-sm text-gray-500 dark:text-gray-400" style={{ animationDelay: '620ms' }}>
            Taking you to your orders…
          </p>
        </div>
      </div>
    );
  }

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
            {count} item{count === 1 ? '' : 's'} from {bySupplier.length} supplier{bySupplier.length === 1 ? '' : 's'}.
            Each supplier delivers and is paid separately.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-xl text-ink dark:text-gray-100 mb-3">Delivery details</h2>
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="address">Delivery address</label>
              <input id="address" className="input" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Stall address or landmark" />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Prefilled from your profile. Change it for this order if you need to.
              </p>
            </div>
            <div>
              <span className="label">When should it arrive?</span>
              <div className="flex flex-wrap gap-2">
                {['', ...SLOTS].map((s) => {
                  const active = slot === s;
                  return (
                    <button
                      key={s || 'anytime'}
                      type="button"
                      onClick={() => setSlot(s)}
                      aria-pressed={active}
                      className={'chip ' + (active
                        ? 'bg-brand-600 text-white'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-night-600 dark:text-gray-300 dark:hover:bg-night-700')}
                    >
                      {s || 'Anytime'}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                The supplier sees your preferred window with the order.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="notes">Notes for the supplier (optional)</label>
              <textarea id="notes" className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. ring the bell, deliver before 8 AM" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              You pay each supplier in cash when their delivery arrives. Online payment is coming.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {bySupplier.map(([sid, group]) => (
            <div key={sid} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-ink dark:text-gray-100">{group.supplierName}</div>
                <div className="tnum text-ink dark:text-gray-100 font-semibold">{money(group.total)}</div>
              </div>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                {group.items.map((it) => (
                  <li key={it.itemId} className="flex justify-between">
                    <span>{it.itemName} · {amount(it.quantity, it.unit)}</span>
                    <span>{money(it.price * it.quantity)}</span>
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
          <div className="flex justify-between text-gray-700 dark:text-gray-300"><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400"><dt>Delivery</dt><dd>Free</dd></div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400"><dt>Deliveries</dt><dd>{bySupplier.length}</dd></div>
        </dl>
        <div className="border-t border-gray-100 dark:border-night-700 my-4" />
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700 dark:text-gray-300">Total</span>
          <span className="tnum text-2xl font-medium tracking-tight text-ink dark:text-gray-100">{money(subtotal)}</span>
        </div>
        <button onClick={placeOrders} disabled={placing} className="btn-primary w-full mt-5">
          {placing ? 'Placing…' : `Place order · ${money(subtotal)}`}
        </button>
        <Link to="/cart" className="btn-ghost w-full mt-2">Back to cart</Link>
      </aside>
    </div>
  );
}
