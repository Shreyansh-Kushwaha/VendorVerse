import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useToast } from '../components/Toast.jsx';
import { useNotifications } from '../notifications.jsx';
import { CATEGORIES, money, perUnit, amount } from '../format.js';
import { useFavorites } from '../favorites.js';
import StatusPill from '../components/ui/StatusPill.jsx';
import Thumb from '../components/ui/Thumb.jsx';
import Stat from '../components/ui/Stat.jsx';

const PAGE_SIZE = 24;

export default function VendorDashboard() {
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const { onNotification } = useNotifications();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const { favorites, toggle: toggleFav } = useFavorites();

  // Catalog now comes from the server one page at a time, filtered there too.
  const [catalog, setCatalog] = useState({ items: [], total: 0, pages: 0 });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ q: '', category: 'all', favOnly: false });

  // Any filter change starts a new result set from page one.
  const applyFilter = (patch) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  // Don't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => applyFilter({ q: search.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search]);

  // Favourites live in localStorage, so the server needs the ids to filter by.
  const favKey = useMemo(() => [...favorites].sort().join(','), [favorites]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (filters.q) params.q = filters.q;
      if (filters.category !== 'all') params.category = filters.category;
      if (filters.favOnly) params.suppliers = favKey;

      const { data } = await api.get('/items', { params });
      setCatalog((prev) => ({
        total: data.total,
        pages: data.pages,
        items: page === 1 ? data.items : [...prev.items, ...data.items],
      }));
    } catch {
      toast.error('Could not load the catalog');
    } finally {
      setCatalogLoading(false);
    }
  }, [page, filters, favKey, toast]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ord, an] = await Promise.all([
        api.get('/vendor/orders'),
        api.get('/vendor/analytics'),
      ]);
      setOrders(ord.data);
      setAnalytics(an.data);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  // Pull fresh data the moment something happens, instead of waiting for the
  // user to hit refresh.
  const loadRef = useRef(loadAll);
  loadRef.current = loadAll;
  useEffect(() => onNotification(() => { loadRef.current(); loadCatalog(); }), [onNotification, loadCatalog]);

  const lastOrder = orders[0];

  const addToCart = (item) => {
    cart.add({
      itemId: item.itemId,
      itemName: item.itemName,
      price: item.price,
      unit: item.unit,
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
      unit: lastOrder.unit,
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
              Cart ({cart.count}) · {money(cart.subtotal)}
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Items available" value={catalog.total} />
        <Stat label="My orders" value={analytics?.totalOrders ?? orders.length} />
        <Stat label="Spend (7 days)" value={money(analytics?.weekSpend)} accent />
        <Stat label="Total spend" value={money(analytics?.totalSpend)} />
      </div>


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
            onClick={() => applyFilter({ favOnly: !filters.favOnly })}
            className={'btn ' + (filters.favOnly
              ? 'bg-brand-600 text-white hover:bg-brand-700'
              : 'btn-ghost')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={filters.favOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            Favorites
          </button>
          <button onClick={() => { loadAll(); loadCatalog(); }} className="btn-ghost sm:w-auto">Refresh</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {['all', ...CATEGORIES].map((c) => {
            const active = filters.category === c;
            return (
              <button
                key={c}
                onClick={() => applyFilter({ category: c })}
                className={'chip capitalize ' + (active
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
        {catalog.items.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Showing {catalog.items.length} of {catalog.total} item{catalog.total === 1 ? '' : 's'}
          </p>
        )}

        {catalogLoading && catalog.items.length === 0 ? (
          <div className="card p-5"><SkeletonRow /></div>
        ) : catalog.items.length === 0 ? (
          <div className="card p-10 text-center text-gray-500 dark:text-gray-400">
            {filters.favOnly ? 'No items from your favorite suppliers match.' : 'No items match your filters.'}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="grid sm:hidden grid-cols-1 gap-3">
              {catalog.items.map((it) => (
                <div key={`${it.supplierId}-${it.itemId}`} className="card p-4 flex gap-3">
                  <Thumb src={it.imageUrl} alt={it.itemName} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-ink dark:text-gray-100 truncate">{it.itemName}</div>
                        <Link to={`/suppliers/${it.supplierId}`} className="text-xs text-gray-500 dark:text-gray-400 truncate hover:text-brand-600 hover:underline">{it.supplierName} • {it.location}</Link>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-brand-700 dark:text-brand-400 font-semibold whitespace-nowrap">{perUnit(it.price, it.unit)}</div>
                        <FavBtn on={favorites.has(it.supplierId)} onClick={() => toggleFav(it.supplierId)} />
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
                      <th className="px-4 py-3">In stock</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink dark:text-gray-200">
                    {catalog.items.map((it) => (
                      <tr key={`${it.supplierId}-${it.itemId}`} className="border-t border-gray-100 dark:border-night-700 hover:bg-brand-50/30 dark:hover:bg-night-700/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Thumb src={it.imageUrl} alt={it.itemName} size="sm" />
                            <span className="font-medium">{it.itemName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">{it.category}</td>
                        <td className="px-4 py-3 font-semibold text-brand-700 dark:text-brand-400 whitespace-nowrap">{perUnit(it.price, it.unit)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{amount(it.quantity, it.unit)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link to={`/suppliers/${it.supplierId}`} className="hover:text-brand-600 hover:underline">{it.supplierName}</Link>
                            <FavBtn on={favorites.has(it.supplierId)} onClick={() => toggleFav(it.supplierId)} />
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

            {page < catalog.pages && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={catalogLoading}
                  className="btn-ghost"
                >
                  {catalogLoading ? 'Loading…' : `Load more (${catalog.total - catalog.items.length} left)`}
                </button>
              </div>
            )}
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
                    {amount(o.quantity, o.unit)} • {perUnit(o.price, o.unit)} • Supplier: {o.supplierId?.name || 'Deleted account'}
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

function SkeletonRow() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 bg-gray-200 dark:bg-night-700 rounded w-1/2" />
      <div className="h-4 bg-gray-200 dark:bg-night-700 rounded w-3/4" />
      <div className="h-4 bg-gray-200 dark:bg-night-700 rounded w-2/3" />
    </div>
  );
}
