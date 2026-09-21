import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { uploadImage } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import { useNotifications } from '../notifications.jsx';
import Modal from '../components/Modal.jsx';
import { UNITS, DEFAULT_UNIT, CATEGORIES, money, perUnit, amount } from '../format.js';
import StatusPill from '../components/ui/StatusPill.jsx';
import Thumb from '../components/ui/Thumb.jsx';
import Stat from '../components/ui/Stat.jsx';
import QuantityStepper from '../components/ui/QuantityStepper.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import { haptic } from '../lib/haptics.js';
import { getPosition } from '../lib/geo.js';
import usePageMeta from '../lib/meta.js';

const NEXT_STATUS = { Pending: 'Accepted', Accepted: 'Packed', Packed: 'OutForDelivery', OutForDelivery: 'Delivered' };
const STATUS_LABELS = { Accepted: 'Accept', Packed: 'Mark packed', OutForDelivery: 'Out for delivery', Delivered: 'Mark delivered' };
const CLOSED = ['Delivered', 'Rejected', 'Cancelled'];
const LOW_STOCK = 5;
const TABS = { orders: 'Orders', inventory: 'Inventory', money: 'Money' };

export default function SupplierDashboard() {
  usePageMeta({
    title: 'Dashboard',
    description:
      'Manage your listings, stock levels and incoming vendor orders.',
    noIndex: true,
  });
  const { user } = useAuth();
  const toast = useToast();
  const { onNotification } = useNotifications();
  const [params, setParams] = useSearchParams();
  const tab = TABS[params.get('tab')] ? params.get('tab') : 'orders';
  const setTab = (t) => setParams(t === 'orders' ? {} : { tab: t }, { replace: true });

  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllOrders, setShowAllOrders] = useState(false);

  const [invSearch, setInvSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // all | low | out

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ itemName: '', price: '', quantity: '', unit: DEFAULT_UNIT, category: '', location: user?.location || '' });
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState(null); // {item, mode: 'edit'|'delete'}
  const [editForm, setEditForm] = useState({ itemName: '', price: '', quantity: '', unit: DEFAULT_UNIT, category: '' });
  const [editBusy, setEditBusy] = useState(false);
  const confirmingDelete = editing?.mode === 'delete';

  const loadAll = useCallback(async () => {
    try {
      const [inv, ord, an] = await Promise.all([
        api.get(`/suppliers/${user._id}/inventory`),
        api.get('/orders'),
        api.get('/supplier/analytics'),
      ]);
      setInventory(inv.data || []);
      setOrders(ord.data || []);
      setAnalytics(an.data);
    } catch {
      toast.error('Failed to load supplier data');
    } finally {
      setLoading(false);
    }
  }, [user._id, toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadRef = useRef(loadAll);
  useEffect(() => { loadRef.current = loadAll; });
  useEffect(() => onNotification(() => loadRef.current()), [onNotification]);

  const updateAdd = (k) => (e) => setAddForm({ ...addForm, [k]: e.target.value });
  const updateEdit = (k) => (e) => setEditForm({ ...editForm, [k]: e.target.value });

  const onAddItem = async (e) => {
    e.preventDefault();
    if (!imageFile) return toast.error('Please choose an image');
    setSubmitting(true);
    try {
      // Best effort — a declined permission or slow GPS never blocks listing.
      const coords = await getPosition(3000);
      const imageUrl = await uploadImage(imageFile);
      await api.post('/suppliers', {
        location: addForm.location,
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        inventory: {
          itemName: addForm.itemName,
          quantity: Number(addForm.quantity),
          price: Number(addForm.price),
          unit: addForm.unit,
          category: addForm.category,
          imageUrl,
        },
      });
      toast.success('Item added');
      setAddOpen(false);
      setAddForm({ itemName: '', price: '', quantity: '', unit: DEFAULT_UNIT, category: '', location: user?.location || '' });
      setImageFile(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to add item');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (item) => {
    setEditing({ item, mode: 'edit' });
    setEditForm({
      itemName: item.itemName,
      price: String(item.price),
      quantity: String(item.quantity),
      unit: item.unit || DEFAULT_UNIT,
      category: item.category || 'others',
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditBusy(true);
    try {
      await api.patch(`/suppliers/${user._id}/inventory/${editing.item._id}`, {
        itemName: editForm.itemName,
        price: Number(editForm.price),
        quantity: Number(editForm.quantity),
        unit: editForm.unit,
        category: editForm.category,
      });
      toast.success('Item updated');
      setEditing(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to update');
    } finally {
      setEditBusy(false);
    }
  };

  const deleteItem = async () => {
    if (!editing) return;
    setEditBusy(true);
    try {
      await api.delete(`/suppliers/${user._id}/inventory/${editing.item._id}`);
      toast.success('Item deleted');
      setEditing(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to delete');
    } finally {
      setEditBusy(false);
    }
  };

  // Correcting stock is the most frequent write in the product. It used to cost
  // four interactions through a modal; now it writes from the row itself, shown
  // immediately and saved once the tapping stops.
  const stockTimers = useRef({});
  useEffect(() => {
    const timers = stockTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const setStock = (item, next) => {
    const previous = item.quantity;
    setInventory((inv) => inv.map(i => (i._id === item._id ? { ...i, quantity: next } : i)));

    clearTimeout(stockTimers.current[item._id]);
    stockTimers.current[item._id] = setTimeout(async () => {
      try {
        await api.patch(`/suppliers/${user._id}/inventory/${item._id}`, { quantity: next });
      } catch (err) {
        setInventory((inv) => inv.map(i => (i._id === item._id ? { ...i, quantity: previous } : i)));
        toast.error(err.response?.data?.msg || `Could not update ${item.itemName} stock`);
      }
    }, 700);
  };

  const advanceStatus = async (orderId, newStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      haptic('medium');
      toast.success(`Order marked ${newStatus === 'OutForDelivery' ? 'out for delivery' : newStatus.toLowerCase()}`);
      loadAll();
    } catch {
      toast.error('Could not update status');
    }
  };

  const lowStock = useMemo(() => inventory.filter(i => i.quantity > 0 && i.quantity <= LOW_STOCK), [inventory]);
  const outOfStock = useMemo(() => inventory.filter(i => i.quantity <= 0), [inventory]);
  const pendingCount = useMemo(() => orders.filter(o => (o.status || 'Pending') === 'Pending').length, [orders]);
  const openCount = useMemo(() => orders.filter(o => !CLOSED.includes(o.status || 'Pending')).length, [orders]);

  const visibleOrders = useMemo(
    () => (showAllOrders ? orders : orders.filter(o => !CLOSED.includes(o.status || 'Pending'))),
    [orders, showAllOrders],
  );

  const visibleInventory = useMemo(() => {
    const q = invSearch.trim().toLowerCase();
    return inventory.filter((i) => {
      if (q && !i.itemName?.toLowerCase().includes(q)) return false;
      if (stockFilter === 'low') return i.quantity > 0 && i.quantity <= LOW_STOCK;
      if (stockFilter === 'out') return i.quantity <= 0;
      return true;
    });
  }, [inventory, invSearch, stockFilter]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Supplier</p>
          <h1 className="text-2xl tracking-tight text-ink dark:text-gray-100 sm:text-3xl">
            {user?.name?.split(' ')[0] || 'Supplier'}
            {pendingCount > 0 && (
              <span className="ml-2 align-middle text-base font-normal text-gray-500 dark:text-gray-400">
                {pendingCount} waiting on you
              </span>
            )}
          </h1>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary self-start sm:self-auto">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add item
        </button>
      </div>

      <div className="mt-5">
        <Tabs
          label="Dashboard sections"
          value={tab}
          onChange={setTab}
          tabs={Object.entries(TABS).map(([key, label]) => ({
            key,
            label,
            badge: key === 'orders' ? openCount : key === 'inventory' ? inventory.length : 0,
          }))}
        />
      </div>

      {tab === 'orders' && (
        <section key="orders" className="mt-6 animate-rise">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {openCount > 0 ? `${openCount} open order${openCount === 1 ? '' : 's'}` : 'Nothing waiting on you right now'}
            </p>
            <button
              type="button" onClick={() => setShowAllOrders(v => !v)}
              className={'chip ' + (showAllOrders
                ? 'bg-brand-600 text-white'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-night-600 dark:text-gray-300 dark:hover:bg-night-700')}
            >
              {showAllOrders ? 'Showing all' : 'Showing open'}
            </button>
          </div>

          {loading ? (
            <SkeletonList />
          ) : visibleOrders.length === 0 ? (
            <EmptyState
              title={showAllOrders ? 'No orders yet' : 'You are all caught up'}
              hint={showAllOrders
                ? 'When vendors place orders, they show up here.'
                : 'Every order has been dealt with. Switch to all to see past ones.'}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleOrders.map((o, i) => {
                const status = o.status || 'Pending';
                const next = NEXT_STATUS[status];
                return (
                  <div
                    key={o._id}
                    className="card card-lift animate-rise flex flex-col gap-2 p-4"
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className={'truncate font-medium ' + (o.vendorId?.name ? 'text-ink dark:text-gray-100' : 'italic text-gray-400 dark:text-gray-500')}>
                          {o.vendorId?.name || 'Deleted account'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(o.date).toLocaleString()}</div>
                      </div>
                      <StatusPill status={status} />
                    </div>

                    <div className="tnum text-sm text-gray-600 dark:text-gray-300">
                      {o.itemName} · {amount(o.quantity, o.unit)} ·{' '}
                      <span className="font-semibold text-ink dark:text-gray-100">{money((o.quantity || 0) * (o.price || 0))}</span>
                    </div>

                    {o.deliveryAddress && (
                      <div className="flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <svg aria-hidden="true" className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{o.deliveryAddress}</span>
                      </div>
                    )}
                    {o.deliverySlot && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <svg aria-hidden="true" className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                        </svg>
                        <span>{o.deliverySlot}</span>
                      </div>
                    )}
                    {o.notes && (
                      <p className="border-l-2 border-gray-200 pl-2 text-xs italic text-gray-600 dark:border-night-600 dark:text-gray-400 whitespace-pre-wrap">
                        {o.notes}
                      </p>
                    )}

                    {next && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        <button onClick={() => advanceStatus(o._id, next)} className="btn-primary text-sm">
                          {STATUS_LABELS[next]}
                        </button>
                        {status === 'Pending' && (
                          <button onClick={() => advanceStatus(o._id, 'Rejected')} className="btn-danger text-sm">Reject</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'inventory' && (
        <section key="inventory" className="mt-6 animate-rise">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className="input sm:max-w-xs" placeholder="Search your items…"
              value={invSearch} onChange={(e) => setInvSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {[
                ['all', `All ${inventory.length}`],
                ['low', `Low ${lowStock.length}`],
                ['out', `Out ${outOfStock.length}`],
              ].map(([key, label]) => (
                <button
                  key={key} onClick={() => setStockFilter(key)} aria-pressed={stockFilter === key}
                  className={'chip ' + (stockFilter === key
                    ? 'bg-brand-600 text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-night-600 dark:text-gray-300 dark:hover:bg-night-700')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <SkeletonList />
          ) : visibleInventory.length === 0 ? (
            <EmptyState
              title={inventory.length === 0 ? 'No inventory yet' : 'Nothing matches'}
              hint={inventory.length === 0
                ? 'Add your first item to start receiving orders. You do not appear in search until you list something.'
                : 'Try a different search or stock filter.'}
              action={inventory.length === 0
                ? <button className="btn-primary mt-4" onClick={() => setAddOpen(true)}>Add item</button>
                : null}
            />
          ) : (
            <ul className="card divide-y divide-gray-200 dark:divide-night-600">
              {visibleInventory.map((it) => (
                <li key={it._id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Thumb src={it.imageUrl} alt={it.itemName} size="sm" category={it.category} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-ink dark:text-gray-100">{it.itemName}</span>
                        {it.quantity <= 0 ? (
                          <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-500/10 dark:text-red-400">Out</span>
                        ) : it.quantity <= LOW_STOCK ? (
                          <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Low</span>
                        ) : null}
                      </div>
                      <div className="tnum truncate text-xs text-gray-500 dark:text-gray-400">
                        {perUnit(it.price, it.unit)} · <span className="capitalize">{it.category || 'others'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <QuantityStepper
                      value={it.quantity} min={0} unit={it.unit || DEFAULT_UNIT}
                      label={`${it.itemName} stock`}
                      onChange={(n) => setStock(it, n)}
                    />
                    <button onClick={() => openEdit(it)} className="btn-ghost text-sm">Edit</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'money' && (
        <section key="money" className="mt-6 animate-rise space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total revenue" value={money(analytics?.totalRevenue)} />
            <Stat label="Total orders" value={analytics?.totalOrders ?? orders.length} />
            <Stat label="Items listed" value={inventory.length} />
            <Stat label="Low or out" value={lowStock.length + outOfStock.length} warn={lowStock.length + outOfStock.length > 0} />
          </div>
          <RevenueChart daily={analytics?.daily} />
        </section>
      )}

      {/* Add modal */}
      <Modal
        open={addOpen}
        onClose={() => !submitting && setAddOpen(false)}
        title="Add inventory item"
        footer={
          <>
            <button className="btn-ghost" type="button" onClick={() => setAddOpen(false)} disabled={submitting}>Cancel</button>
            <button form="addItemForm" className="btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add item'}
            </button>
          </>
        }
      >
        <form id="addItemForm" onSubmit={onAddItem} className="space-y-3">
          <div>
            <label className="label" htmlFor="itemName">Item name</label>
            <input id="itemName" required className="input" value={addForm.itemName} onChange={updateAdd('itemName')} />
          </div>
          <div>
            <label className="label" htmlFor="unit">Sold by</label>
            <select id="unit" required className="input" value={addForm.unit} onChange={updateAdd('unit')}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="price">Price per {addForm.unit}</label>
              <input id="price" type="number" min="0" step="0.01" required className="input" value={addForm.price} onChange={updateAdd('price')} />
            </div>
            <div>
              <label className="label" htmlFor="quantity">Stock ({addForm.unit})</label>
              <input id="quantity" type="number" min="0" required className="input" value={addForm.quantity} onChange={updateAdd('quantity')} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select id="category" required className="input" value={addForm.category} onChange={updateAdd('category')}>
              <option value="">— Select category —</option>
              {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="location">Location</label>
            <input id="location" required className="input" value={addForm.location} onChange={updateAdd('location')} />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              If you allow the location prompt, vendors also see how far away you are.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="image">Image (max 5 MB)</label>
            <input
              id="image" type="file" accept="image/*" required
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-ink hover:file:bg-gray-200 dark:text-gray-400 dark:file:bg-night-700 dark:file:text-gray-100"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
            {imageFile && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Selected: {imageFile.name}</p>}
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => !editBusy && setEditing(null)}
        title={editing ? (confirmingDelete ? `Delete ${editing.item.itemName}?` : `Edit ${editing.item.itemName}`) : ''}
        footer={confirmingDelete ? (
          <>
            <button className="btn-ghost" type="button" onClick={() => setEditing({ ...editing, mode: 'edit' })} disabled={editBusy}>Back</button>
            <button className="btn-danger-solid" type="button" onClick={deleteItem} disabled={editBusy}>
              {editBusy ? 'Deleting…' : `Delete ${editing?.item.itemName}`}
            </button>
          </>
        ) : (
          <>
            <button className="btn-ghost" type="button" onClick={() => setEditing(null)} disabled={editBusy}>Close</button>
            <button className="btn-primary" type="button" onClick={saveEdit} disabled={editBusy}>{editBusy ? 'Saving…' : 'Save'}</button>
          </>
        )}
      >
        {editing && confirmingDelete && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <strong>{editing.item.itemName}</strong> will be removed from your catalog along with its{' '}
            {amount(editing.item.quantity, editing.item.unit)} of stock. Orders already placed for it are not
            affected. This cannot be undone.
          </div>
        )}

        {editing && !confirmingDelete && (
          <div className="space-y-3">
            <div>
              <label className="label">Item name</label>
              <input className="input" value={editForm.itemName} onChange={updateEdit('itemName')} />
            </div>
            <div>
              <label className="label">Sold by</label>
              <select className="input" value={editForm.unit} onChange={updateEdit('unit')}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Price per {editForm.unit}</label>
                <input type="number" min="0" step="0.01" className="input" value={editForm.price} onChange={updateEdit('price')} />
              </div>
              <div>
                <label className="label">Stock ({editForm.unit})</label>
                <input type="number" min="0" className="input" value={editForm.quantity} onChange={updateEdit('quantity')} />
              </div>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={editForm.category} onChange={updateEdit('category')}>
                {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>

            <div className="border-t border-gray-200 pt-3 dark:border-night-600">
              <button
                type="button"
                onClick={() => setEditing({ ...editing, mode: 'delete' })}
                className="text-sm text-red-700 hover:underline dark:text-red-400"
              >
                Delete this item
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Values used to appear on :hover only, which is unreachable on the phone most
// suppliers use. They are printed above the bars instead.
function RevenueChart({ daily }) {
  if (!daily?.length) return null;
  const max = Math.max(1, ...daily.map(d => d.revenue));
  const total = daily.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base text-ink dark:text-gray-100">Revenue · last 7 days</h2>
        <span className="tnum text-sm font-semibold text-ink dark:text-gray-100">{money(total)}</span>
      </div>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Excludes rejected and cancelled orders.</p>

      <div className="mt-5 flex h-40 items-end gap-1.5 sm:gap-2">
        {daily.map((d) => {
          const pct = (d.revenue / max) * 100;
          return (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="tnum text-[10px] text-gray-500 dark:text-gray-400">
                {d.revenue > 0 ? money(d.revenue) : '—'}
              </div>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-brand-600 dark:bg-brand-500"
                  style={{ height: `${Math.max(pct, 1.5)}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                {new Date(d.day).toLocaleDateString(undefined, { weekday: 'short' })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ title, hint, action }) {
  return (
    <div className="card p-10 text-center">
      <div className="font-medium text-ink dark:text-gray-100">{title}</div>
      <div className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{hint}</div>
      {action}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="skel h-20 rounded-xl" />)}
    </div>
  );
}
