import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useToast } from '../components/Toast.jsx';

export default function SupplierProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [favorited, setFavorited] = useState(() => isFavorite(id));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/suppliers/${id}`);
        if (!cancelled) setSupplier(data);
      } catch {
        if (!cancelled) toast.error('Supplier not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, toast]);

  const items = useMemo(() => {
    if (!supplier) return [];
    const q = search.trim().toLowerCase();
    return q ? supplier.inventory.filter(i => i.itemName?.toLowerCase().includes(q)) : supplier.inventory;
  }, [supplier, search]);

  const toggleFavorite = () => {
    const next = !favorited;
    setFavorited(next);
    setFavorite(id, next);
    toast.info(next ? 'Saved to favorites' : 'Removed from favorites');
  };

  if (loading) return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 text-gray-500 dark:text-gray-400">Loading supplier…</div>;
  if (!supplier) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
        <h1 className="font-display text-2xl text-ink dark:text-gray-100">Supplier not found</h1>
        <Link to="/vendor" className="btn-primary mt-4">Back</Link>
      </div>
    );
  }

  const initials = (supplier.name || '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
  const isVendor = user?.userType === 'vendor';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="card overflow-hidden">
        <div className="h-32 bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600" />
        <div className="px-6 pb-6 -mt-12">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="h-24 w-24 rounded-2xl bg-white dark:bg-night-700 shadow-pop ring-4 ring-white dark:ring-night-800 grid place-items-center font-display text-3xl text-brand-700 dark:text-brand-300">
              {initials}
            </div>
            {isVendor && (
              <button
                onClick={toggleFavorite}
                className={'btn ' + (favorited
                  ? 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-night-700 dark:text-brand-300 dark:border-night-600'
                  : 'bg-white text-gray-600 border border-gray-200 dark:bg-night-800 dark:text-gray-300 dark:border-night-600 hover:bg-brand-50')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {favorited ? 'Favorited' : 'Add to favorites'}
              </button>
            )}
          </div>
          <div className="mt-4">
            <h1 className="font-display text-3xl text-ink dark:text-gray-100">{supplier.name}</h1>
            {supplier.businessName && <p className="text-sm text-gray-600 dark:text-gray-400">{supplier.businessName}</p>}
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">📍 {supplier.location}</p>
            {supplier.memberSince && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Member since {new Date(supplier.memberSince).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="font-display text-xl text-ink dark:text-gray-100">
            Catalog <span className="text-gray-400 text-base">({supplier.inventory.length} items)</span>
          </h2>
          <input
            className="input sm:max-w-xs"
            placeholder="Search this catalog…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {items.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No items found.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((it) => (
              <div key={it._id} className="rounded-xl overflow-hidden border border-gray-100 dark:border-night-700">
                {it.imageUrl
                  ? <img src={it.imageUrl} alt={it.itemName} className="aspect-square w-full object-cover" />
                  : <div className="aspect-square bg-brand-100 text-brand-700 dark:bg-night-700 dark:text-brand-300 grid place-items-center font-bold text-xl">{it.itemName?.[0]?.toUpperCase() || '?'}</div>}
                <div className="p-3">
                  <div className="font-medium text-ink dark:text-gray-100 truncate">{it.itemName}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-brand-700 dark:text-brand-400 font-semibold">₹{it.price}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{it.category}</span>
                  </div>
                  {isVendor && (
                    <button
                      className="btn-primary w-full mt-3 py-1.5 text-sm"
                      onClick={() => {
                        cart.add({
                          itemId: it._id,
                          itemName: it.itemName,
                          price: it.price,
                          imageUrl: it.imageUrl,
                          supplierId: supplier._id,
                          supplierName: supplier.name,
                          location: supplier.location,
                        }, 1);
                        toast.success(`Added ${it.itemName}`);
                      }}
                    >
                      Add to cart
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const FAV_KEY = 'vv_favorites';
function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}
function isFavorite(id) {
  return getFavorites().includes(id);
}
function setFavorite(id, on) {
  const list = new Set(getFavorites());
  if (on) list.add(id); else list.delete(id);
  localStorage.setItem(FAV_KEY, JSON.stringify([...list]));
}
