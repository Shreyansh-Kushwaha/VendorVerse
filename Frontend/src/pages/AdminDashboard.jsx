import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Stat from '../components/ui/Stat.jsx';
import Stars from '../components/ui/Stars.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import { money, perUnit } from '../format.js';
import usePageMeta from '../lib/meta.js';

const ROLES = ['all', 'vendor', 'supplier', 'admin'];

// The marketplace from above: who is here, what is moving, and the two levers
// moderation actually needs — suspend an account, remove what shouldn't be up.
export default function AdminDashboard() {
  usePageMeta({
    title: 'Admin',
    description:
      'Moderate accounts, listings and reports across VendorVerse.',
    noIndex: true,
  });
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [tab, setTab] = useState('users');

  const loadOverview = useCallback(() => {
    api.get('/admin/overview')
      .then(({ data }) => setOverview(data))
      .catch(() => toast.error('Could not load the overview'));
  }, [toast]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Admin</p>
        <h1 className="text-2xl tracking-tight text-ink dark:text-gray-100 sm:text-3xl">The marketplace</h1>
      </div>

      {overview ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Vendors" value={overview.users.vendors} />
            <Stat label="Suppliers" value={`${overview.stockedSuppliers} of ${overview.users.suppliers} stocked`} />
            <Stat label="Orders · GMV" value={`${overview.orders} · ${money(overview.gmv)}`} />
            <Stat label="Suspended" value={overview.users.suspended} warn={overview.users.suspended > 0} />
          </div>

          {overview.orders > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(overview.ordersByStatus).map(([status, n]) => (
                <span key={status} className="tnum rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 dark:border-night-600 dark:text-gray-300">
                  {status || 'Pending'} <span className="font-semibold">{n}</span>
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skel h-20 rounded-xl" />)}
        </div>
      )}

      <div className="mt-8">
        <Tabs
          label="Admin sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'users', label: 'Users', badge: overview ? overview.users.vendors + overview.users.suppliers + overview.users.admins : 0 },
            { key: 'reviews', label: 'Reviews', badge: overview?.reviews || 0 },
            { key: 'listings', label: 'Listings' },
          ]}
        />
        <div className="mt-4">
          {tab === 'users' && <UsersTab onChanged={loadOverview} />}
          {tab === 'reviews' && <ReviewsTab onChanged={loadOverview} />}
          {tab === 'listings' && <ListingsTab />}
        </div>
      </div>
    </div>
  );
}

// Destructive actions arm on the first tap and fire on the second, so a slip
// of the thumb never moderates anyone. Disarms itself after a beat.
function DangerButton({ label, confirm = 'Sure?', onFire, subtle }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2500);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      onClick={() => { if (armed) { setArmed(false); onFire(); } else setArmed(true); }}
      className={'btn text-xs ' + (armed
        ? 'bg-red-600 text-white'
        : subtle
          ? 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-night-600 dark:text-gray-300 dark:hover:bg-night-700'
          : 'border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10')}
    >
      {armed ? confirm : label}
    </button>
  );
}

function UsersTab({ onChanged }) {
  const toast = useToast();
  const [data, setData] = useState({ users: [], total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setQ(search.trim()); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let on = true;
    setLoading(true);
    api.get('/admin/users', { params: { page, role, ...(q ? { q } : {}) } })
      .then(({ data }) => {
        if (!on) return;
        setData((prev) => ({
          total: data.total,
          pages: data.pages,
          users: page === 1 ? data.users : [...prev.users, ...data.users],
        }));
      })
      .catch(() => { if (on) toast.error('Could not load users'); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [page, q, role, toast]);

  const setSuspended = async (u, suspended) => {
    try {
      const { data: d } = await api.patch(`/admin/users/${u._id}/suspend`, { suspended });
      setData((prev) => ({ ...prev, users: prev.users.map(x => (x._id === u._id ? { ...x, suspended } : x)) }));
      toast.success(d.msg);
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not update the account');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input flex-1"
          placeholder="Search name, email, city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => { setRole(r); setPage(1); }}
              aria-pressed={role === r}
              className={'chip capitalize ' + (role === r
                ? 'bg-brand-600 text-white'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-night-600 dark:text-gray-300 dark:hover:bg-night-700')}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading && data.users.length === 0 ? (
          <div className="space-y-2 p-5"><div className="skel h-5 w-2/3" /><div className="skel h-5 w-1/2" /></div>
        ) : data.users.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No accounts match.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-night-700">
            {data.users.map((u) => (
              <li key={u._id} className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink dark:text-gray-100">{u.name}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-night-700 dark:text-gray-300">
                      {u.userType}
                    </span>
                    {u.suspended && (
                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-500/10 dark:text-red-400">
                        Suspended
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                    {u.email} · {u.location}
                    {u.businessName && ` · ${u.businessName}`}
                    {' · joined '}{new Date(u.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {u.userType === 'supplier' && (
                    <Link to={`/suppliers/${u._id}`} className="btn text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-night-600 dark:text-gray-300 dark:hover:bg-night-700">
                      Profile
                    </Link>
                  )}
                  {u.userType !== 'admin' && (
                    u.suspended
                      ? <button onClick={() => setSuspended(u, false)} className="btn-primary text-xs">Restore</button>
                      : <DangerButton label="Suspend" confirm="Suspend?" onFire={() => setSuspended(u, true)} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {page < data.pages && (
        <div className="text-center">
          <button onClick={() => setPage(p => p + 1)} disabled={loading} className="btn-ghost">
            {loading ? 'Loading…' : `Load more (${data.total - data.users.length} left)`}
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewsTab({ onChanged }) {
  const toast = useToast();
  const [data, setData] = useState({ reviews: [], total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    setLoading(true);
    api.get('/admin/reviews', { params: { page } })
      .then(({ data }) => {
        if (!on) return;
        setData((prev) => ({
          total: data.total,
          pages: data.pages,
          reviews: page === 1 ? data.reviews : [...prev.reviews, ...data.reviews],
        }));
      })
      .catch(() => { if (on) toast.error('Could not load reviews'); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [page, toast]);

  const remove = async (r) => {
    try {
      await api.delete(`/admin/reviews/${r._id}`);
      setData((prev) => ({ ...prev, total: prev.total - 1, reviews: prev.reviews.filter(x => x._id !== r._id) }));
      toast.success('Review removed');
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not remove the review');
    }
  };

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        {loading && data.reviews.length === 0 ? (
          <div className="space-y-2 p-5"><div className="skel h-5 w-2/3" /><div className="skel h-5 w-1/2" /></div>
        ) : data.reviews.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No reviews yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-night-700">
            {data.reviews.map((r) => (
              <li key={r._id} className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Stars value={r.rating} size={12} />
                    <span className="text-gray-600 dark:text-gray-300">
                      <span className="font-medium text-ink dark:text-gray-100">{r.vendorId?.name || 'Deleted vendor'}</span>
                      {' on '}
                      <span className="font-medium text-ink dark:text-gray-100">{r.supplierId?.name || 'Deleted supplier'}</span>
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(r.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {r.comment && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">“{r.comment}”</p>}
                </div>
                <div className="shrink-0">
                  <DangerButton label="Remove" confirm="Remove?" onFire={() => remove(r)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {page < data.pages && (
        <div className="text-center">
          <button onClick={() => setPage(p => p + 1)} disabled={loading} className="btn-ghost">
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

// Rides the same paginated catalog every vendor sees — moderation looks at the
// shelf exactly as buyers do, then pulls what shouldn't be on it.
function ListingsTab() {
  const toast = useToast();
  const [data, setData] = useState({ items: [], total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setQ(search.trim()); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let on = true;
    setLoading(true);
    api.get('/items', { params: { page, limit: 24, ...(q ? { q } : {}) } })
      .then(({ data }) => {
        if (!on) return;
        setData((prev) => ({
          total: data.total,
          pages: data.pages,
          items: page === 1 ? data.items : [...prev.items, ...data.items],
        }));
      })
      .catch(() => { if (on) toast.error('Could not load listings'); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [page, q, toast]);

  const remove = async (it) => {
    try {
      await api.delete(`/admin/listings/${it.supplierId}/${it.itemId}`);
      setData((prev) => ({ ...prev, total: prev.total - 1, items: prev.items.filter(x => x.itemId !== it.itemId) }));
      toast.success(`${it.itemName} removed`);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not remove the listing');
    }
  };

  return (
    <div className="space-y-3">
      <input
        className="input"
        placeholder="Search listings or suppliers…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card overflow-hidden">
        {loading && data.items.length === 0 ? (
          <div className="space-y-2 p-5"><div className="skel h-5 w-2/3" /><div className="skel h-5 w-1/2" /></div>
        ) : data.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No listings match.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-night-700">
            {data.items.map((it) => (
              <li key={`${it.supplierId}-${it.itemId}`} className="flex items-center gap-4 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink dark:text-gray-100">
                    {it.itemName}
                    <span className="tnum ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                      {perUnit(it.price, it.unit)} · {it.quantity} left
                    </span>
                  </div>
                  <Link to={`/suppliers/${it.supplierId}`} className="text-xs text-gray-500 hover:underline dark:text-gray-400">
                    {it.supplierName} · {it.location}
                  </Link>
                </div>
                <div className="shrink-0">
                  <DangerButton label="Remove" confirm="Remove?" onFire={() => remove(it)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {page < data.pages && (
        <div className="text-center">
          <button onClick={() => setPage(p => p + 1)} disabled={loading} className="btn-ghost">
            {loading ? 'Loading…' : `Load more (${data.total - data.items.length} left)`}
          </button>
        </div>
      )}
    </div>
  );
}
