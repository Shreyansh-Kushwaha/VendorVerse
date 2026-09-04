import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCart } from '../cart.jsx';
import { useToast } from '../components/Toast.jsx';
import { perUnit, amount } from '../format.js';
import { useFavorites } from '../favorites.js';
import Stars from '../components/ui/Stars.jsx';
import PriceTrendModal from '../components/PriceTrend.jsx';
import usePageMeta from '../lib/meta.js';

export default function SupplierProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const [supplier, setSupplier] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [trendItem, setTrendItem] = useState(null);
  const { isFavorite, toggle } = useFavorites();
  const favorited = isFavorite(id);

  // Supplier pages are the ones worth being found in search, so the title and
  // description are built from the supplier itself once it loads rather than
  // every one of them sharing a single generic snippet.
  usePageMeta({
    title: supplier ? `${supplier.name} — supplier` : 'Supplier',
    description: supplier
      ? `Order raw ingredients from ${supplier.name}${supplier.location ? ` in ${supplier.location}` : ''} on VendorVerse. See live stock, per-unit prices and vendor ratings.`
      : 'View a supplier on VendorVerse — live stock, per-unit prices and vendor ratings.',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/suppliers/${id}`);
        if (!cancelled) setSupplier(data);
        // Reviews are decoration on this page — a failure just hides them.
        api.get(`/suppliers/${id}/reviews`)
          .then((r) => { if (!cancelled) setReviews(r.data); })
          .catch(() => {});
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
    toggle(id);
    toast.info(favorited ? 'Removed from favorites' : 'Saved to favorites');
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
        <div className="px-6 py-6">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="grid h-16 w-16 place-items-center rounded-xl border border-gray-200 bg-gray-50 text-xl font-medium text-gray-600 dark:border-night-600 dark:bg-night-700 dark:text-gray-300">
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
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{supplier.location}</p>
            {supplier.rating != null && (
              <div className="mt-1.5 text-sm">
                <Stars value={supplier.rating} count={supplier.ratingCount} size={15} />
              </div>
            )}
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
                    <button
                      type="button"
                      title="Price history"
                      onClick={() => setTrendItem({ itemId: it._id, itemName: it.itemName, price: it.price, unit: it.unit })}
                      className="tnum text-ink dark:text-gray-100 font-semibold underline decoration-dotted decoration-gray-300 underline-offset-2 hover:decoration-brand-600 dark:decoration-night-500 dark:hover:decoration-brand-400 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400"
                    >
                      {perUnit(it.price, it.unit)}
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{it.category}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{amount(it.quantity, it.unit)} in stock</div>
                  {isVendor && (
                    <button
                      className="btn-ghost w-full mt-3 text-sm"
                      onClick={() => {
                        cart.add({
                          itemId: it._id,
                          itemName: it.itemName,
                          price: it.price,
                          unit: it.unit,
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

      {reviews?.count > 0 && (
        <section className="card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h2 className="font-display text-xl text-ink dark:text-gray-100">
              Reviews <span className="text-gray-400 text-base">({reviews.count})</span>
            </h2>
            <Stars value={reviews.average} size={15} />
          </div>
          <ul className="space-y-4">
            {reviews.reviews.map((r) => (
              <li key={r._id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0 dark:border-night-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink dark:text-gray-100">{r.vendorName}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-1"><Stars value={r.rating} size={13} /></div>
                {r.comment && <p className="text-sm text-gray-700 dark:text-gray-300 mt-1.5 whitespace-pre-wrap">{r.comment}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Every review comes from a delivered order — there is no other way to leave one.
          </p>
        </section>
      )}

      <PriceTrendModal item={trendItem} onClose={() => setTrendItem(null)} />
    </div>
  );
}
