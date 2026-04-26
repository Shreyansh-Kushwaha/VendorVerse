import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useToast } from '../components/Toast.jsx';

const CATEGORIES = ['all', 'Vegetables', 'Fruits', 'Spices', 'Grains', 'Dairy', 'Others'];
const FAV_KEY = 'vv_favorites';

function readFavs() { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch { return new Set(); } }
function writeFavs(set) { localStorage.setItem(FAV_KEY, JSON.stringify([...set])); }

export default function VendorDashboard() {
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [favOnly, setFavOnly] = useState(false);
  const [favs, setFavs] = useState(readFavs);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sup, ord, an] = await Promise.all([
        api.get('/suppliers'),
        api.get('/vendor/orders', { params: { vendorId: user._id } }),
        api.get('/vendor/analytics', { params: { vendorId: user._id } }),
      ]);

      const flat = [];
      sup.data.forEach((s) => {
        (s.inventory || []).forEach((it) => {
          flat.push({
            itemId: it._id,
            itemName: it.itemName,
            price: it.price,
            quantity: it.quantity,
            category: it.category || 'others',
            imageUrl: it.imageUrl,
            supplierId: s.supplierId,
            supplierName: s.name,
            location: s.location,
          });
        });
      });
      setItems(flat);
      setOrders(ord.data);
      setAnalytics(an.data);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  const toggleFav = (supplierId) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      writeFavs(next);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (favOnly && !favs.has(it.supplierId)) return false;
      const matchCat = category === 'all' || it.category?.toLowerCase() === category.toLowerCase();
      const matchQ = !q || it.itemName?.toLowerCase().includes(q) || it.supplierName?.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [items, search, category, favOnly, favs]);

  const deals = useMemo(() => items.slice(0, 4), [items]);
  const lastOrder = orders[0];

  const addToCart = (item) => {
    cart.add({
      itemId: item.itemId,
      itemName: item.itemName,
      price: item.price,
      imageUrl: item.imageUrl,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      location: item.location,
    }, 1);
    toast.success(`Added ${item.itemName}`);
  };

  const repeatLast = () => {
    if (!lastOrder) return;
    cart.add({
      itemId: lastOrder.itemId,
      itemName: lastOrder.itemName,
      price: lastOrder.price,
      supplierId: lastOrder.supplierId?._id || lastOrder.supplierId,
      supplierName: lastOrder.supplierId?.name || 'Supplier',
      location: lastOrder.supplierId?.location || '',
    }, lastOrder.quantity || 1);
    toast.success('Added to cart');
    navigate('/cart');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Vendor dashboard</p>
          <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-gray-100">
            Hello, <span className="text-brand-600 dark:text-brand-400">{user?.name?.split(' ')[0] || 'Vendor'}</span> 👋
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastOrder && (
            <button onClick={repeatLast} className="btn-ghost">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
              Repeat last order
            </button>
          )}
          {cart.count > 0 && (
            <Link to="/cart" className="btn-primary">
              Cart ({cart.count}) · ₹{cart.subtotal}
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Items available" value={items.length} />
        <Stat label="My orders" value={analytics?.totalOrders ?? orders.length} />
        <Stat label="Spend (7 days)" value={`₹${analytics?.weekSpend ?? 0}`} accent />
        <Stat label="Total spend" value={`₹${analytics?.totalSpend ?? 0}`} />
      </div>

      {/* Today's deals */}
      <section className="card p-5">
        <h2 className="font-display text-xl text-ink dark:text-gray-100 mb-3">Today's best deals</h2>
        {loading ? (
          <SkeletonRow />
        ) : deals.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No deals yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {deals.map((d) => (
              <div key={d.itemId} className="rounded-xl border border-brand-100 bg-brand-50/40 dark:border-night-600 dark:bg-night-700/50 p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">From {d.supplierName}</div>
                <div className="font-medium text-ink dark:text-gray-100 truncate">{d.itemName}</div>
                <div className="text-brand-700 dark:text-brand-400 font-semibold">₹{d.price}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Search + categories */}
      <section className="card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" strokeLinecap="round"/></svg>
            <input
              className="input pl-10"
              placeholder="Search items or suppliers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setFavOnly(v => !v)}
            className={'btn ' + (favOnly
              ? 'bg-brand-600 text-white hover:bg-brand-700'
              : 'btn-ghost')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={favOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            Favorites
          </button>
          <button onClick={loadAll} className="btn-ghost sm:w-auto">Refresh</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = category.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={'chip ' + (active
                  ? 'bg-brand-600 text-white'
                  : 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-night-700 dark:text-brand-300 dark:hover:bg-night-600')}
              >
                {c === 'all' ? 'All' : c}
              </button>
            );
          })}
        </div>
      </section>

      {/* Items */}
      <section>
        {loading ? (
          <div className="card p-5"><SkeletonRow /></div>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center text-gray-500 dark:text-gray-400">
            {favOnly ? 'No items from your favorite suppliers match.' : 'No items match your filters.'}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="grid sm:hidden grid-cols-1 gap-3">
              {filtered.map((it) => (
                <div key={`${it.supplierId}-${it.itemId}`} className="card p-4 flex gap-3">
                  <Thumb src={it.imageUrl} alt={it.itemName} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-ink dark:text-gray-100 truncate">{it.itemName}</div>
                        <Link to={`/suppliers/${it.supplierId}`} className="text-xs text-gray-500 dark:text-gray-400 truncate hover:text-brand-600 hover:underline">{it.supplierName} • {it.location}</Link>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-brand-700 dark:text-brand-400 font-semibold whitespace-nowrap">₹{it.price}</div>
                        <FavBtn on={favs.has(it.supplierId)} onClick={() => toggleFav(it.supplierId)} />
                      </div>
                    </div>
                    <button onClick={() => addToCart(it)} className="btn-primary w-full mt-3 py-1.5 text-sm">Add to cart</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-brand-50/60 dark:bg-night-700/60 text-left text-gray-700 dark:text-gray-300">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink dark:text-gray-200">
                    {filtered.map((it) => (
                      <tr key={`${it.supplierId}-${it.itemId}`} className="border-t border-gray-100 dark:border-night-700 hover:bg-brand-50/30 dark:hover:bg-night-700/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Thumb src={it.imageUrl} alt={it.itemName} sm />
                            <span className="font-medium">{it.itemName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">{it.category}</td>
                        <td className="px-4 py-3 font-semibold text-brand-700 dark:text-brand-400">₹{it.price}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link to={`/suppliers/${it.supplierId}`} className="hover:text-brand-600 hover:underline">{it.supplierName}</Link>
                            <FavBtn on={favs.has(it.supplierId)} onClick={() => toggleFav(it.supplierId)} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{it.location}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => addToCart(it)} className="btn-primary py-1.5 text-sm">Add to cart</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      {/* My orders */}
      <section className="card p-5">
        <h2 className="font-display text-xl text-ink dark:text-gray-100 mb-3">My orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">You haven't placed any orders yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-night-700">
            {orders.map((o) => (
              <li key={o._id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <Link to={`/orders/${o._id}`} className="min-w-0 flex-1 group">
                  <div className="font-medium text-ink dark:text-gray-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">{o.itemName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Qty {o.quantity} • ₹{o.price} • Supplier: {o.supplierId?.name || '—'}
                  </div>
                </Link>
                <StatusPill status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FavBtn({ on, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      aria-label={on ? 'Remove from favorites' : 'Add to favorites'}
      className={'p-1 rounded-md transition ' + (on
        ? 'text-brand-600 dark:text-brand-400'
        : 'text-gray-300 hover:text-brand-500 dark:text-gray-600 dark:hover:text-brand-400')}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={'font-display text-2xl mt-1 ' + (accent ? 'text-brand-600 dark:text-brand-400' : 'text-ink dark:text-gray-100')}>{value}</div>
    </div>
  );
}

function Thumb({ src, alt, sm }) {
  const [err, setErr] = useState(false);
  const cls = sm ? 'h-10 w-10' : 'h-16 w-16';
  if (!src || err) return <div className={`${cls} rounded-lg bg-brand-100 text-brand-700 dark:bg-night-700 dark:text-brand-300 grid place-items-center font-bold shrink-0`}>{alt?.[0]?.toUpperCase() || '?'}</div>;
  return <img src={src} alt={alt} onError={() => setErr(true)} className={`${cls} rounded-lg object-cover shrink-0`} />;
}

function StatusPill({ status }) {
  const s = (status || 'Pending');
  const map = {
    Pending:        'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    Accepted:       'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
    Packed:         'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300',
    OutForDelivery: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
    Delivered:      'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    Rejected:       'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    Cancelled:      'bg-gray-100 text-gray-700 dark:bg-night-700 dark:text-gray-300',
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${map[s] || ''}`}>{s}</span>;
}

function SkeletonRow() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 bg-gray-200 dark:bg-night-700 rounded w-1/2" />
      <div className="h-4 bg-gray-200 dark:bg-night-700 rounded w-3/4" />
      <div className="h-4 bg-gray-200 dark:bg-night-700 rounded w-2/3" />
    </div>
  );
}
