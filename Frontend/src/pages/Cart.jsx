import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart.jsx';

export default function Cart() {
  const { items, update, remove, clear, count, subtotal } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="text-6xl mb-3">🛒</div>
        <h1 className="font-display text-3xl text-ink dark:text-gray-100">Your cart is empty</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Browse suppliers and add items to start an order.</p>
        <Link to="/vendor" className="btn-primary mt-6">Browse items</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 grid lg:grid-cols-[1fr_320px] gap-6">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-3xl text-ink dark:text-gray-100">Cart <span className="text-gray-400 text-base">({count} items)</span></h1>
          <button onClick={clear} className="text-sm text-gray-500 hover:text-red-600 dark:hover:text-red-400">Clear all</button>
        </div>

        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.itemId} className="card p-4 flex gap-3">
              <Thumb src={it.imageUrl} alt={it.itemName} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-ink dark:text-gray-100 truncate">{it.itemName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">From {it.supplierName} • {it.location}</div>
                  </div>
                  <button
                    onClick={() => remove(it.itemId)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    aria-label="Remove"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-night-600">
                    <button
                      className="px-2.5 py-1 text-gray-700 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-night-700 rounded-l-lg"
                      onClick={() => update(it.itemId, it.quantity - 1)}
                    >−</button>
                    <input
                      type="number" min={1}
                      value={it.quantity}
                      onChange={(e) => update(it.itemId, parseInt(e.target.value) || 1)}
                      className="w-12 text-center bg-transparent text-ink dark:text-gray-100 focus:outline-none"
                    />
                    <button
                      className="px-2.5 py-1 text-gray-700 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-night-700 rounded-r-lg"
                      onClick={() => update(it.itemId, it.quantity + 1)}
                    >+</button>
                  </div>
                  <div className="text-right">
                    <div className="text-brand-700 dark:text-brand-400 font-semibold">₹{it.price * it.quantity}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">₹{it.price} each</div>
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
            <dt>Subtotal</dt><dd>₹{subtotal}</dd>
          </div>
          <div className="flex justify-between text-gray-700 dark:text-gray-300">
            <dt>Items</dt><dd>{count}</dd>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <dt>Delivery</dt><dd>Calculated at checkout</dd>
          </div>
        </dl>
        <div className="border-t border-gray-100 dark:border-night-700 my-4" />
        <div className="flex items-center justify-between">
          <span className="text-gray-700 dark:text-gray-300 font-medium">Total</span>
          <span className="font-display text-2xl text-brand-700 dark:text-brand-400">₹{subtotal}</span>
        </div>
        <button onClick={() => navigate('/checkout')} className="btn-primary w-full mt-5">
          Proceed to checkout
        </button>
        <Link to="/vendor" className="btn-ghost w-full mt-2">Continue shopping</Link>
      </aside>
    </div>
  );
}

function Thumb({ src, alt }) {
  if (!src) {
    return <div className="h-16 w-16 rounded-lg bg-brand-100 text-brand-700 dark:bg-night-700 dark:text-brand-300 grid place-items-center font-bold shrink-0">{alt?.[0]?.toUpperCase() || '?'}</div>;
  }
  return <img src={src} alt={alt} className="h-16 w-16 rounded-lg object-cover shrink-0" />;
}
