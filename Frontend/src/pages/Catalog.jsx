import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useToast } from '../components/Toast.jsx';
import { CATEGORIES, perUnit, amount } from '../format.js';
import { useFavorites } from '../favorites.js';
import Thumb from '../components/ui/Thumb.jsx';
import Stars from '../components/ui/Stars.jsx';
import PriceTrendModal from '../components/PriceTrend.jsx';
import QuantityStepper from '../components/ui/QuantityStepper.jsx';
import { haptic } from '../lib/haptics.js';
import { flyToCart } from '../lib/flyToCart.js';
import usePageMeta from '../lib/meta.js';

const PAGE_SIZE = 24;

// The public price-comparison page: the same flat, cheapest-offer-first
// catalog a signed-in vendor gets on their dashboard, open to anyone. No
// account needed to see what things cost — only to actually order them.
export default function Catalog() {
  usePageMeta({
    title: 'Catalog',
    description:
      'Compare raw ingredient prices across every supplier on VendorVerse — no account needed to browse.',
  });
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const { favorites, toggle: toggleFav } = useFavorites();
  const canShop = !user || user.userType === 'vendor';

  // Restock alerts are a signed-in-vendor feature; a guest tapping the same
  // control gets routed to sign up instead of a silent 401.
  const [alerts, setAlerts] = useState(() => new Set());
  useEffect(() => {
    if (user?.userType !== 'vendor') return;
    let on = true;
    api.get('/stock-alerts')
      .then(({ data }) => { if (on) setAlerts(new Set(data.alerts.map(a => a.itemId))); })
      .catch(() => {});
    return () => { on = false; };
  }, [user?.userType]);

  const toggleAlert = async (it) => {
    if (user?.userType !== 'vendor') {
      toast.info('Sign up to get notified when this restocks');
      navigate('/signup');
      return;
    }
    const watching = alerts.has(it.itemId);
    setAlerts((prev) => {
      const next = new Set(prev);
      if (watching) next.delete(it.itemId); else next.add(it.itemId);
      return next;
    });
    try {
      if (watching) {
        await api.delete(`/stock-alerts/${it.itemId}`);
      } else {
        await api.post('/stock-alerts', { supplierId: it.supplierId, itemId: it.itemId });
        haptic('tick');
        toast.success(`You will hear when ${it.itemName} is back`);
      }
    } catch (err) {
      setAlerts((prev) => {
        const next = new Set(prev);
        if (watching) next.add(it.itemId); else next.delete(it.itemId);
        return next;
      });
      toast.error(err.response?.data?.msg || 'Could not update the alert');
    }
  };

  const [catalog, setCatalog] = useState({ items: [], total: 0, pages: 0 });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ q: '', category: 'all', favOnly: false });
  const [trendItem, setTrendItem] = useState(null);

  const applyFilter = (patch) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setFilters((prev) => (prev.q === search.trim() ? prev : { ...prev, q: search.trim() }));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

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

  const groups = useMemo(() => {
    const out = [];
    for (const it of catalog.items) {
      const last = out[out.length - 1];
      if (last && last.name === it.itemName) last.offers.push(it);
      else out.push({ name: it.itemName, offers: [it] });
    }
    return out;
  }, [catalog.items]);

  const addToCart = (it, fromEl, n) => {
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
    flyToCart(fromEl);
    haptic('tick');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Compare prices</p>
          <h1 className="text-2xl tracking-tight text-ink dark:text-gray-100 sm:text-3xl">Catalog</h1>
        </div>
        {!user && (
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm sm:text-right">
            Browsing as a guest — add items freely, we’ll only ask you to sign up when you’re ready to check out.
          </p>
        )}
      </div>

      <section className="card mt-6 space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <svg aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" /></svg>
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
                  ? 'bg-brand-600 text-white'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-night-600 dark:text-gray-300 dark:hover:bg-night-700')}
              >
                {c === 'all' ? 'All' : c}
              </button>
            );
          })}
        </div>
      </section>

      {!user && (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-4 border-brand-200 bg-brand-50/60 dark:border-brand-500/30 dark:bg-brand-500/5">
          <p className="text-sm text-ink dark:text-gray-100">
            Want suppliers sorted by distance? <span className="text-gray-600 dark:text-gray-400">Sign up to find who's near you.</span>
          </p>
          <Link to="/signup" className="btn-ghost shrink-0">Sign up</Link>
        </div>
      )}

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
              {groups.map((g, i) => (
                <div key={g.name} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <ItemGroup
                    group={g}
                    canShop={canShop}
                    favorites={favorites}
                    onToggleFav={toggleFav}
                    onAdd={addToCart}
                    alerts={alerts}
                    onToggleAlert={toggleAlert}
                    onShowTrend={setTrendItem}
                  />
                </div>
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

      <PriceTrendModal item={trendItem} onClose={() => setTrendItem(null)} />

      {canShop && cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden dark:border-night-600 dark:bg-night-800">
          <Link to="/cart" className="btn-primary w-full">
            Review cart · {cart.count} item{cart.count === 1 ? '' : 's'}
          </Link>
        </div>
      )}
    </div>
  );
}

function ItemGroup({ group, canShop, favorites, onToggleFav, onAdd, alerts, onToggleAlert, onShowTrend }) {
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
          <OfferRow
            key={`${it.supplierId}-${it.itemId}`}
            it={it}
            cheapest={i === 0 && offers.length > 1}
            canShop={canShop}
            favorite={favorites.has(it.supplierId)}
            onToggleFav={onToggleFav}
            onAdd={onAdd}
            watching={alerts.has(it.itemId)}
            onToggleAlert={onToggleAlert}
            onShowTrend={onShowTrend}
          />
        ))}
      </ul>
    </div>
  );
}

function OfferRow({ it, cheapest, canShop, favorite, onToggleFav, onAdd, watching, onToggleAlert, onShowTrend }) {
  const [qty, setQty] = useState(1);

  return (
    <li className="flex flex-col gap-3 p-3 first:border-t-0 border-t border-gray-200 sm:flex-row sm:items-center sm:gap-4 dark:border-night-600">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Thumb src={it.imageUrl} alt={it.itemName} size="sm" category={it.category} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Link to={`/suppliers/${it.supplierId}`} className="truncate text-sm font-medium text-ink hover:underline dark:text-gray-100">
              {it.supplierName}
            </Link>
            {cheapest && (
              <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                Cheapest
              </span>
            )}
            {canShop && <FavBtn on={favorite} onClick={() => onToggleFav(it.supplierId)} />}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="truncate">{it.location}</span>
            {it.rating != null && <Stars value={it.rating} count={it.ratingCount} size={11} className="shrink-0" />}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <button
          type="button"
          onClick={() => onShowTrend(it)}
          title="Price history"
          className="text-left sm:text-right rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400"
        >
          <div className="tnum text-sm font-semibold text-ink underline decoration-dotted decoration-gray-300 underline-offset-2 hover:decoration-brand-600 dark:text-gray-100 dark:decoration-night-500 dark:hover:decoration-brand-400">
            {perUnit(it.price, it.unit)}
          </div>
          <div className="tnum text-xs text-gray-500 dark:text-gray-400">{amount(it.quantity, it.unit)} left</div>
        </button>
        {canShop && (
          <div className="flex items-center gap-2">
            <QuantityStepper
              value={qty}
              onChange={setQty}
              unit={it.unit}
              max={it.quantity}
              label={`${it.itemName} from ${it.supplierName}`}
            />
            {it.quantity < 1
              ? <NotifyButton on={watching} onClick={() => onToggleAlert(it)} />
              : <AddButton onAdd={(el) => onAdd(it, el, qty)} />}
          </div>
        )}
      </div>
    </li>
  );
}

function AddButton({ onAdd, disabled }) {
  const ref = useRef(null);
  const [added, setAdded] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handle = () => {
    onAdd(ref.current);
    setAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1000);
  };

  return (
    <button ref={ref} onClick={handle} disabled={disabled} className="btn-primary relative text-sm">
      <span className={'transition-opacity duration-150 ' + (added ? 'opacity-0' : '')}>
        {disabled ? 'Out' : 'Add'}
      </span>
      <span
        aria-hidden
        className={'absolute inset-0 grid place-items-center transition-[opacity,transform] duration-200 ease-spring ' +
          (added ? 'scale-100 opacity-100' : 'scale-50 opacity-0')}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
      </span>
    </button>
  );
}

function NotifyButton({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={'btn text-sm ' + (on
        ? 'border border-brand-200 bg-brand-50 text-brand-700 dark:border-night-600 dark:bg-night-700 dark:text-brand-300'
        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-night-600 dark:bg-night-800 dark:text-gray-300 dark:hover:bg-night-700')}
    >
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {on ? 'Watching' : 'Notify me'}
    </button>
  );
}

function FavBtn({ on, onClick }) {
  const [pulse, setPulse] = useState(0);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); e.preventDefault();
        if (!on) { setPulse((p) => p + 1); haptic('tick'); }
        onClick();
      }}
      aria-pressed={on}
      aria-label={on ? 'Remove supplier from saved' : 'Save supplier'}
      className={'shrink-0 rounded p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400 ' +
        (on ? 'text-brand-600 dark:text-brand-400' : 'text-gray-300 hover:text-brand-600 dark:text-gray-600 dark:hover:text-brand-400')}
    >
      <svg aria-hidden="true" key={pulse} className={pulse && on ? 'animate-pop' : ''} width="14" height="14" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="space-y-2">
      <div className="skel h-4 w-1/2" />
      <div className="skel h-4 w-3/4" />
      <div className="skel h-4 w-2/3" />
    </div>
  );
}
