import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useToast } from '../components/Toast.jsx';
import { useNotifications } from '../notifications.jsx';
import { CATEGORIES, money, perUnit, amount } from '../format.js';
import { useFavorites } from '../favorites.js';
import Thumb from '../components/ui/Thumb.jsx';
import Stat from '../components/ui/Stat.jsx';
import QuantityStepper from '../components/ui/QuantityStepper.jsx';

const PAGE_SIZE = 24;
const OPEN_STATUSES = ['Pending', 'Accepted', 'Packed', 'OutForDelivery'];

export default function VendorDashboard() {
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const { onNotification } = useNotifications();

  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const { favorites, toggle: toggleFav } = useFavorites();

  // Catalog comes from the server one page at a time, filtered and sorted there.
  const [catalog, setCatalog] = useState({ items: [], total: 0, pages: 0 });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ q: '', category: 'all', favOnly: false });
  // Quantity is chosen before adding, keyed by listing.
  const [qty, setQty] = useState({});

  const applyFilter = (patch) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  // Don't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setFilters((prev) => (prev.q === search.trim() ? prev : { ...prev, q: search.trim() }));
    }, 300);
    return () => clearTimeout(t);
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

  const loadAll = useCallback(async () => {
    try {
      const [ord, an] = await Promise.all([
        api.get('/vendor/orders'),
        api.get('/vendor/analytics'),
      ]);
      setOrders(ord.data);
      setAnalytics(an.data);
    } catch {
      toast.error('Failed to load your orders');
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Pull fresh data the moment something happens, instead of waiting for the
  // user to hit refresh.
  const loadRef = useRef(loadAll);
  useEffect(() => { loadRef.current = loadAll; });
  useEffect(() => onNotification(() => { loadRef.current(); loadCatalog(); }), [onNotification, loadCatalog]);

  // The server sorts by item name then price, so identical items arrive adjacent
  // and cheapest first. Walking the list once is enough to group them, and it
  // keeps working across appended pages.
  const groups = useMemo(() => {
    const out = [];
    for (const it of catalog.items) {
      const last = out[out.length - 1];
      if (last && last.name === it.itemName) last.offers.push(it);
      else out.push({ name: it.itemName, offers: [it] });
    }
    return out;
  }, [catalog.items]);

  const openOrders = useMemo(
    () => orders.filter(o => OPEN_STATUSES.includes(o.status || 'Pending')).length,
    [orders],
  );

  const keyOf = (it) => `${it.supplierId}-${it.itemId}`;
  const qtyOf = (it) => qty[keyOf(it)] ?? 1;

  const addToCart = (it) => {
    const n = qtyOf(it);
    cart.add({
      itemId: it.itemId,
      itemName: it.itemName,
      price: it.price,
      unit: it.unit,
      imageUrl: it.imageUrl,
      supplierId: it.supplierId,
      supplierName: it.supplierName,
      location: it.location,
    }, n);
    toast.success(`Added ${amount(n, it.unit)} of ${it.itemName}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pb-10 sm:pt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Vendor</p>
          <h1 className="text-2xl tracking-tight text-ink dark:text-gray-100 sm:text-3xl">
            Restock, {user?.name?.split(' ')[0] || 'there'}
          </h1>
        </div>
        <Link to="/orders" className="btn-ghost self-start sm:self-auto">
          View orders{openOrders > 0 ? ` (${openOrders} open)` : ''}
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Open orders" value={openOrders} />
        <Stat label="Spend (7 days)" value={money(analytics?.weekSpend)} />
        <Stat label="Total spend" value={money(analytics?.totalSpend)} />
        <Stat label="Saved suppliers" value={favorites.size} />
      </div>

      <section className="card mt-6 space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" /></svg>
            <input
              className="input pl-10"
              placeholder="Search items or suppliers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => applyFilter({ favOnly: !filters.favOnly })}
            aria-pressed={filters.favOnly}
            className={filters.favOnly ? 'btn-primary' : 'btn-ghost'}
          >
            Saved only
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {['all', ...CATEGORIES].map((c) => {
            const active = filters.category === c;
            return (
              <button
                key={c}
                onClick={() => applyFilter({ category: c })}
                aria-pressed={active}
                className={'chip capitalize ' + (active
                  ? 'bg-ink text-white dark:bg-gray-100 dark:text-ink'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-night-600 dark:text-gray-300 dark:hover:bg-night-700')}
              >
                {c === 'all' ? 'All' : c}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        {catalogLoading && catalog.items.length === 0 ? (
          <div className="card p-5"><SkeletonRow /></div>
        ) : groups.length === 0 ? (
          <div className="card p-10 text-center text-gray-500 dark:text-gray-400">
            {filters.favOnly ? 'None of your saved suppliers stock a match.' : 'No items match your filters.'}
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              {groups.length} item{groups.length === 1 ? '' : 's'} · {catalog.items.length} of {catalog.total} listing{catalog.total === 1 ? '' : 's'}
            </p>

            <div className="space-y-4">
              {groups.map((g) => (
                <ItemGroup
                  key={g.name}
                  group={g}
                  favorites={favorites}
                  onToggleFav={toggleFav}
                  qtyOf={qtyOf}
                  setQty={(it, n) => setQty((q) => ({ ...q, [keyOf(it)]: n }))}
                  onAdd={addToCart}
                />
              ))}
            </div>

            {page < catalog.pages && (
              <div className="mt-4 text-center">
                <button onClick={() => setPage(p => p + 1)} disabled={catalogLoading} className="btn-ghost">
                  {catalogLoading ? 'Loading…' : `Load more (${catalog.total - catalog.items.length} left)`}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* The cart is the reason this page exists, so on a phone it stays in reach. */}
      {cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden dark:border-night-600 dark:bg-night-800">
          <Link to="/cart" className="btn-primary w-full">
            <span className="tnum">Review cart · {cart.count} item{cart.count === 1 ? '' : 's'} · {money(cart.subtotal)}</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function ItemGroup({ group, favorites, onToggleFav, qtyOf, setQty, onAdd }) {
  const { name, offers } = group;
  const low = offers[0].price;
  const high = offers[offers.length - 1].price;
  const unit = offers[0].unit;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-night-600 dark:bg-night-700/40">
        <h2 className="text-base text-ink dark:text-gray-100">{name}</h2>
        <p className="tnum text-xs text-gray-500 dark:text-gray-400">
          {offers.length} supplier{offers.length === 1 ? '' : 's'}
          {offers.length > 1 && ` · ${perUnit(low, unit)}–${perUnit(high, unit)}`}
        </p>
      </div>

      <ul>
        {offers.map((it, i) => (
          <li
            key={`${it.supplierId}-${it.itemId}`}
            className="flex flex-col gap-3 p-3 first:border-t-0 border-t border-gray-200 sm:flex-row sm:items-center sm:gap-4 dark:border-night-600"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Thumb src={it.imageUrl} alt={it.itemName} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Link to={`/suppliers/${it.supplierId}`} className="truncate text-sm font-medium text-ink hover:underline dark:text-gray-100">
                    {it.supplierName}
                  </Link>
                  {i === 0 && offers.length > 1 && (
                    <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                      Cheapest
                    </span>
                  )}
                  <FavBtn on={favorites.has(it.supplierId)} onClick={() => onToggleFav(it.supplierId)} />
                </div>
                <div className="truncate text-xs text-gray-500 dark:text-gray-400">{it.location}</div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <div className="text-left sm:text-right">
                <div className="tnum text-sm font-semibold text-ink dark:text-gray-100">{perUnit(it.price, it.unit)}</div>
                <div className="tnum text-xs text-gray-500 dark:text-gray-400">{amount(it.quantity, it.unit)} left</div>
              </div>
              <div className="flex items-center gap-2">
                <QuantityStepper
                  value={qtyOf(it)}
                  onChange={(n) => setQty(it, n)}
                  unit={it.unit}
                  max={it.quantity}
                  label={`${it.itemName} from ${it.supplierName}`}
                />
                <button onClick={() => onAdd(it)} disabled={it.quantity < 1} className="btn-ghost text-sm">
                  {it.quantity < 1 ? 'Out' : 'Add'}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FavBtn({ on, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      aria-pressed={on}
      aria-label={on ? 'Remove supplier from saved' : 'Save supplier'}
      className={'shrink-0 rounded p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink dark:focus-visible:ring-gray-100 ' +
        (on ? 'text-ink dark:text-gray-100' : 'text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300')}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-night-700" />
      <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-night-700" />
      <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-night-700" />
    </div>
  );
}
