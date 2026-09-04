import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Stars from '../components/ui/Stars.jsx';
import { getPosition, distanceKm, formatKm } from '../lib/geo.js';
import usePageMeta from '../lib/meta.js';

const PAGE_SIZE = 12;
const SORTS = [
  ['rating', 'Top rated'],
  ['items', 'Most items'],
  ['name', 'Name A–Z'],
];

// Every supplier with something listed, on one browsable page. The catalog
// answers "who sells onions cheapest"; this page answers "who is here at all".
export default function Suppliers() {
  usePageMeta({
    title: 'Suppliers',
    description:
      'Browse verified raw material suppliers near you. Compare per-unit prices, live stock and vendor ratings before you order.',
  });
  const toast = useToast();
  const [data, setData] = useState({ suppliers: [], total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('rating');

  // Distances are opt-in, same as the dashboard: asked for on tap, never on load.
  const [pos, setPos] = useState(null);
  const [locating, setLocating] = useState(false);

  const findMe = async () => {
    if (pos) return setPos(null);
    setLocating(true);
    const p = await getPosition();
    setLocating(false);
    if (!p) return toast.error('Could not get your location — check the browser permission');
    setPos(p);
  };

  // Don't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setQ((prev) => (prev === search.trim() ? prev : search.trim()));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let on = true;
    setLoading(true);
    const params = { page, limit: PAGE_SIZE, sort };
    if (q) params.q = q;
    api.get('/suppliers', { params })
      .then(({ data }) => {
        if (!on) return;
        setData((prev) => ({
          total: data.total,
          pages: data.pages,
          suppliers: page === 1 ? data.suppliers : [...prev.suppliers, ...data.suppliers],
        }));
      })
      .catch(() => { if (on) toast.error('Could not load suppliers'); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [page, q, sort, toast]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Directory</p>
          <h1 className="text-2xl tracking-tight text-ink dark:text-gray-100 sm:text-3xl">Suppliers</h1>
        </div>
        {data.total > 0 && (
          <p className="tnum text-sm text-gray-500 dark:text-gray-400">
            {data.total} supplier{data.total === 1 ? '' : 's'} with live stock
          </p>
        )}
      </div>

      <section className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" /></svg>
          <input
            className="input pl-10"
            placeholder="Search by name or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SORTS.map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setSort(v); setPage(1); }}
              aria-pressed={sort === v}
              className={'chip ' + (sort === v
                ? 'bg-brand-600 text-white'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-night-600 dark:text-gray-300 dark:hover:bg-night-700')}
            >
              {label}
            </button>
          ))}
          <button
            onClick={findMe}
            aria-pressed={!!pos}
            disabled={locating}
            className={'chip ' + (pos
              ? 'bg-brand-600 text-white'
              : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-night-600 dark:text-gray-300 dark:hover:bg-night-700')}
          >
            {locating ? 'Locating…' : 'Show distance'}
          </button>
        </div>
      </section>

      {loading && data.suppliers.length === 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="skel h-40 rounded-xl" />)}
        </div>
      ) : data.suppliers.length === 0 ? (
        <div className="card mt-6 p-10 text-center text-gray-500 dark:text-gray-400">
          No suppliers match “{q}”.
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.suppliers.map((s, i) => (
              <div key={s.supplierId} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <SupplierCard s={s} pos={pos} />
              </div>
            ))}
          </div>

          {page < data.pages && (
            <div className="mt-6 text-center">
              <button onClick={() => setPage(p => p + 1)} disabled={loading} className="btn-ghost">
                {loading ? 'Loading…' : `Load more (${data.total - data.suppliers.length} left)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SupplierCard({ s, pos }) {
  const km = pos && s.geo?.coordinates ? distanceKm(pos, s.geo.coordinates) : null;
  return (
    <Link to={`/suppliers/${s.supplierId}`} className="card card-lift block h-full p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-ink dark:text-gray-100">{s.name}</div>
          <div className="truncate text-xs text-gray-500 dark:text-gray-400">{s.location}</div>
        </div>
        {km != null && (
          <span className="tnum shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            {formatKm(km)}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
        {s.rating != null
          ? <Stars value={s.rating} count={s.ratingCount} size={11} />
          : <span className="text-gray-400 dark:text-gray-500">No ratings yet</span>}
        <span className="tnum">· {s.items} item{s.items === 1 ? '' : 's'}</span>
      </div>

      {s.itemNames?.length > 0 && (
        <p className="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">
          {s.itemNames.join(', ')}{s.items > s.itemNames.length ? '…' : ''}
        </p>
      )}

      {s.categories?.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {s.categories.slice(0, 4).map((c) => (
            <span key={c} className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] capitalize text-gray-500 dark:border-night-600 dark:text-gray-400">
              {c}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
