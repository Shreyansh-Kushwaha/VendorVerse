import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { money, perUnit } from '../format.js';
import Thumb from '../components/ui/Thumb.jsx';
import QuantityStepper from '../components/ui/QuantityStepper.jsx';
import RollingNumber from '../components/ui/RollingNumber.jsx';
import { haptic } from '../lib/haptics.js';
import usePageMeta from '../lib/meta.js';

const COLLAPSE_MS = 260;
const UNDO_MS = 5000;

export default function Cart() {
  usePageMeta({
    title: 'Cart',
    description:
      'Review the items in your cart before you place the order.',
    noIndex: true,
  });
  const { user } = useAuth();
  const { items, add, update, remove, clear, count, subtotal } = useCart();
  const navigate = useNavigate();
  // A vendor's browse links go to their dashboard; anyone else (a guest, or a
  // supplier/admin who wandered in) lands on the public catalog instead.
  const browseHref = user?.userType === 'vendor' ? '/vendor' : '/catalog';

  // Removal is reversible for five seconds: the row collapses, a bar with a
  // draining timer appears, and Undo puts everything back.
  const [leaving, setLeaving] = useState(() => new Set());
  const [undo, setUndo] = useState(null); // { label, items, key }
  const undoTimer = useRef(null);
  const collapseTimers = useRef([]);
  useEffect(() => () => {
    clearTimeout(undoTimer.current);
    collapseTimers.current.forEach(clearTimeout);
  }, []);

  // The key only needs to be unique per toast; a counter keeps this pure.
  const undoKey = useRef(0);
  const showUndo = (label, snapshot) => {
    clearTimeout(undoTimer.current);
    setUndo({ label, items: snapshot, key: ++undoKey.current });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  };

  const removeWithUndo = (it) => {
    haptic('tick');
    setLeaving((s) => new Set(s).add(it.itemId));
    collapseTimers.current.push(setTimeout(() => {
      remove(it.itemId);
      setLeaving((s) => { const n = new Set(s); n.delete(it.itemId); return n; });
      showUndo(`${it.itemName} removed`, [{ ...it }]);
    }, COLLAPSE_MS));
  };

  const clearWithUndo = () => {
    haptic('tick');
    showUndo('Cart cleared', items.map((i) => ({ ...i })));
    clear();
  };

  const doUndo = () => {
    clearTimeout(undoTimer.current);
    undo.items.forEach((it) => add({ ...it }, it.quantity));
    setUndo(null);
  };

  const undoBar = undo && (
    <div key={undo.key} className="fixed inset-x-4 bottom-4 z-40 animate-toast-in sm:inset-x-auto sm:left-1/2 sm:w-96 sm:-translate-x-1/2">
      <div className="relative flex items-center gap-3 overflow-hidden rounded-lg bg-gray-900 px-4 py-3 text-sm text-gray-100 shadow-pop dark:bg-night-700">
        <span className="min-w-0 flex-1 truncate">{undo.label}</span>
        <button
          onClick={doUndo}
          className="shrink-0 rounded px-1 font-semibold text-brand-300 hover:text-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          Undo
        </button>
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-brand-500"
          style={{ animation: `undo-drain ${UNDO_MS}ms linear forwards` }}
        />
      </div>
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="font-display text-3xl text-ink dark:text-gray-100">Your cart is empty</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Browse suppliers and add items to start an order.</p>
        <Link to={browseHref} className="btn-primary mt-6">Browse items</Link>
        {undoBar}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 grid lg:grid-cols-[1fr_320px] gap-6">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-3xl text-ink dark:text-gray-100">Cart <span className="text-gray-400 text-base">({count} items)</span></h1>
          <button onClick={clearWithUndo} className="text-sm text-gray-500 hover:text-red-600 dark:hover:text-red-400">Clear all</button>
        </div>

        <ul>
          {items.map((it) => (
            // The row collapses via grid-template-rows — the one layout property
            // cheap enough to animate on a single row — so the list closes over
            // the gap instead of snapping.
            <li
              key={it.itemId}
              className={'grid transition-[grid-template-rows,opacity] duration-[260ms] ease-out-quart ' +
                (leaving.has(it.itemId) ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]')}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="pb-3">
                  <div className="card p-4 flex gap-3">
                    <Thumb src={it.imageUrl} alt={it.itemName} category={it.category} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-ink dark:text-gray-100 truncate">{it.itemName}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">From {it.supplierName} • {it.location}</div>
                        </div>
                        <button
                          onClick={() => removeWithUndo(it)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                          aria-label="Remove"
                        >
                          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <QuantityStepper
                          value={it.quantity}
                          onChange={(n) => update(it.itemId, n)}
                          unit={it.unit || 'kg'}
                          label={it.itemName}
                        />
                        <div className="text-right">
                          <div className="tnum text-ink dark:text-gray-100 font-semibold">{money(it.price * it.quantity)}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">{perUnit(it.price, it.unit)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <aside className="card p-5 h-fit lg:sticky lg:top-20">
        <h2 className="font-display text-xl text-ink dark:text-gray-100 mb-4">Order summary</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-700 dark:text-gray-300">
            <dt>Subtotal</dt><dd>{money(subtotal)}</dd>
          </div>
          <div className="flex justify-between text-gray-700 dark:text-gray-300">
            <dt>Items</dt><dd>{count}</dd>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <dt>Delivery</dt><dd>Free</dd>
          </div>
        </dl>
        <div className="border-t border-gray-100 dark:border-night-700 my-4" />
        <div className="flex items-center justify-between">
          <span className="text-gray-700 dark:text-gray-300 font-medium">Total</span>
          <RollingNumber value={money(subtotal)} className="tnum text-2xl font-medium tracking-tight text-ink dark:text-gray-100" />
        </div>
        <button onClick={() => navigate('/checkout')} className="btn-primary w-full mt-5">
          Proceed to checkout
        </button>
        <Link to={browseHref} className="btn-ghost w-full mt-2">Continue shopping</Link>
      </aside>

      {undoBar}
    </div>
  );
}
