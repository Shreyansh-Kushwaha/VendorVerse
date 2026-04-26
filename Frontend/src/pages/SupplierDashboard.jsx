import { useEffect, useMemo, useState } from 'react';
import api, { uploadImage } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';

const CATEGORY_OPTIONS = ['vegetables', 'fruits', 'spices', 'grains', 'dairy', 'others'];
const FLOW = ['Pending', 'Accepted', 'Packed', 'OutForDelivery', 'Delivered'];
const NEXT_STATUS = { Pending: 'Accepted', Accepted: 'Packed', Packed: 'OutForDelivery', OutForDelivery: 'Delivered' };
const STATUS_LABELS = { Pending: 'Pending', Accepted: 'Accept', Packed: 'Mark packed', OutForDelivery: 'Out for delivery', Delivered: 'Mark delivered' };
const LOW_STOCK = 5;

export default function SupplierDashboard() {
  const { user } = useAuth();
  const toast = useToast();

  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ordersOpen, setOrdersOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ itemName: '', price: '', quantity: '', category: '', location: user?.location || '' });
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState(null); // {item, mode: 'edit'|'delete'}
  const [editForm, setEditForm] = useState({ itemName: '', price: '', quantity: '', category: '' });
  const [editBusy, setEditBusy] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [inv, ord, an] = await Promise.all([
        api.get(`/suppliers/${user._id}/inventory`),
        api.get('/orders', { params: { supplierId: user._id } }),
        api.get('/supplier/analytics', { params: { supplierId: user._id } }),
      ]);
      setInventory(inv.data || []);
      setOrders(ord.data || []);
      setAnalytics(an.data);
    } catch {
      toast.error('Failed to load supplier data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  const updateAdd = (k) => (e) => setAddForm({ ...addForm, [k]: e.target.value });
  const updateEdit = (k) => (e) => setEditForm({ ...editForm, [k]: e.target.value });

  const onAddItem = async (e) => {
    e.preventDefault();
    if (!imageFile) return toast.error('Please choose an image');
    setSubmitting(true);
    try {
      const imageUrl = await uploadImage(imageFile);
      await api.post('/suppliers', {
        supplierId: user._id,
        name: user.name,
        location: addForm.location,
        inventory: {
          itemName: addForm.itemName,
          quantity: Number(addForm.quantity),
          price: Number(addForm.price),
          category: addForm.category,
          imageUrl,
        },
      });
      toast.success('Item added');
      setAddOpen(false);
      setAddForm({ itemName: '', price: '', quantity: '', category: '', location: user?.location || '' });
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

  const advanceStatus = async (orderId, newStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      toast.success(`Order → ${newStatus}`);
      loadAll();
    } catch {
      toast.error('Could not update status');
    }
  };

  const lowStockCount = useMemo(() => inventory.filter(i => i.quantity <= LOW_STOCK).length, [inventory]);
  const maxDaily = analytics ? Math.max(1, ...analytics.daily.map(d => d.revenue)) : 1;
  const pendingCount = useMemo(() => orders.filter(o => (o.status || 'Pending') === 'Pending').length, [orders]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Supplier dashboard</p>
          <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-gray-100">
            Welcome, <span className="text-brand-600 dark:text-brand-400">{user?.name?.split(' ')[0] || 'Supplier'}</span>
          </h1>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Add inventory
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total revenue" value={`₹${analytics?.totalRevenue ?? 0}`} accent />
        <Stat label="Items in stock" value={inventory.length} />
        <Stat label="Total orders" value={analytics?.totalOrders ?? orders.length} />
        <Stat
          label="Low stock"
          value={lowStockCount}
          warn={lowStockCount > 0}
        />
      </div>

      {/* Revenue chart */}
      {analytics && (
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl text-ink dark:text-gray-100">Revenue · last 7 days</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">Excludes rejected/cancelled</span>
          </div>
          <div className="flex items-end gap-2 h-32">
            {analytics.daily.map((d) => {
              const pct = (d.revenue / maxDaily) * 100;
              const day = new Date(d.day).toLocaleDateString(undefined, { weekday: 'short' });
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition">₹{d.revenue}</div>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 transition-all"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">{day}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Inventory header + Incoming-orders notification button */}
      <section>
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="font-display text-2xl text-ink dark:text-gray-100">Inventory</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{inventory.length} item{inventory.length === 1 ? '' : 's'} listed</p>
          </div>
          <button
            type="button"
            onClick={() => setOrdersOpen(true)}
            className="relative inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-white dark:bg-night-800 border border-brand-100 dark:border-night-600 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-night-700 shadow-card transition"
            aria-label={`Incoming orders (${pendingCount} pending)`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            <span className="hidden sm:inline text-sm font-medium">Incoming orders</span>
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold grid place-items-center ring-2 ring-white dark:ring-night-900 animate-pulse">
                +{pendingCount > 99 ? '99' : pendingCount}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <SkeletonGrid />
        ) : inventory.length === 0 ? (
          <EmptyState
            title="No inventory yet"
            hint="Add your first item to start receiving orders."
            action={<button className="btn-primary mt-3" onClick={() => setAddOpen(true)}>Add inventory</button>}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {inventory.map((it) => (
              <button
                key={it._id}
                onClick={() => openEdit(it)}
                className="card overflow-hidden text-left group focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <div className="relative">
                  <Thumb src={it.imageUrl} alt={it.itemName} square />
                  {it.quantity <= LOW_STOCK && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white shadow">
                      {it.quantity === 0 ? 'OUT' : 'LOW'}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-medium text-ink dark:text-gray-100 truncate">{it.itemName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{it.category || 'others'}</div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-brand-700 dark:text-brand-400 font-semibold">₹{it.price}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{it.quantity} qty</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Incoming orders modal */}
      <Modal
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        title={`Incoming orders${pendingCount > 0 ? ` · ${pendingCount} pending` : ''}`}
        size="xl"
        footer={
          <>
            <button className="btn-ghost" onClick={loadAll}>Refresh</button>
            <button className="btn-primary" onClick={() => setOrdersOpen(false)}>Close</button>
          </>
        }
      >
        {orders.length === 0 ? (
          <div className="py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
            No orders yet. When vendors place orders, they'll show up here.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o._id} className="rounded-xl border border-gray-100 dark:border-night-600 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-ink dark:text-gray-100">{o.vendorId?.name || 'Vendor'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(o.date).toLocaleString()}</div>
                  </div>
                  <StatusPill status={o.status || 'Pending'} />
                </div>
                <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  {o.itemName} × {o.quantity}{' '}
                  <span className="text-gray-400">·</span>{' '}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">₹{(o.quantity || 0) * (o.price || 0)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {o.status !== 'Rejected' && o.status !== 'Cancelled' && o.status !== 'Delivered' && (
                    <button
                      onClick={() => advanceStatus(o._id, NEXT_STATUS[o.status || 'Pending'])}
                      className="btn bg-emerald-600 text-white hover:bg-emerald-700 text-sm py-1.5"
                    >
                      {STATUS_LABELS[NEXT_STATUS[o.status || 'Pending']]}
                    </button>
                  )}
                  {o.status === 'Pending' && (
                    <button
                      onClick={() => advanceStatus(o._id, 'Rejected')}
                      className="btn-danger text-sm py-1.5"
                    >Reject</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="price">Price (₹)</label>
              <input id="price" type="number" min="0" step="0.01" required className="input" value={addForm.price} onChange={updateAdd('price')} />
            </div>
            <div>
              <label className="label" htmlFor="quantity">Quantity</label>
              <input id="quantity" type="number" min="0" required className="input" value={addForm.quantity} onChange={updateAdd('quantity')} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select id="category" required className="input" value={addForm.category} onChange={updateAdd('category')}>
              <option value="">— Select category —</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="location">Location</label>
            <input id="location" required className="input" value={addForm.location} onChange={updateAdd('location')} />
          </div>
          <div>
            <label className="label" htmlFor="image">Image (max 5 MB)</label>
            <input
              id="image" type="file" accept="image/*" required
              className="block w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-night-700 dark:file:text-brand-300 dark:hover:file:bg-night-600"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
            {imageFile && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Selected: {imageFile.name}</p>}
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => !editBusy && setEditing(null)}
        title={editing ? `Edit · ${editing.item.itemName}` : ''}
        footer={
          <>
            <button className="btn-ghost" type="button" onClick={() => setEditing(null)} disabled={editBusy}>Close</button>
            <button className="btn-danger" type="button" onClick={deleteItem} disabled={editBusy}>Delete</button>
            <button className="btn-primary" type="button" onClick={saveEdit} disabled={editBusy}>{editBusy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <div>
              <label className="label">Item name</label>
              <input className="input" value={editForm.itemName} onChange={updateEdit('itemName')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Price (₹)</label>
                <input type="number" min="0" step="0.01" className="input" value={editForm.price} onChange={updateEdit('price')} />
              </div>
              <div>
                <label className="label">Quantity</label>
                <input type="number" min="0" className="input" value={editForm.quantity} onChange={updateEdit('quantity')} />
              </div>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={editForm.category} onChange={updateEdit('category')}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Stat({ label, value, accent, warn }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={
        'font-display text-3xl mt-1 ' +
        (warn ? 'text-red-600 dark:text-red-400' :
         accent ? 'text-brand-600 dark:text-brand-400' :
         'text-ink dark:text-gray-100')
      }>{value}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    Pending:        'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    Accepted:       'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
    Packed:         'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300',
    OutForDelivery: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
    Delivered:      'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    Rejected:       'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    Cancelled:      'bg-gray-100 text-gray-700 dark:bg-night-700 dark:text-gray-300',
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${map[status] || ''}`}>{status}</span>;
}

function Thumb({ src, alt, square }) {
  const [err, setErr] = useState(false);
  const cls = square ? 'aspect-square w-full' : 'h-16 w-16';
  if (!src || err) return <div className={`${cls} bg-brand-100 text-brand-700 dark:bg-night-700 dark:text-brand-300 grid place-items-center font-bold`}>{alt?.[0]?.toUpperCase() || '?'}</div>;
  return <img src={src} alt={alt} onError={() => setErr(true)} className={`${cls} object-cover`} />;
}

function EmptyState({ title, hint, action }) {
  return (
    <div className="card p-8 text-center">
      <div className="font-medium text-ink dark:text-gray-100">{title}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{hint}</div>
      {action}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card overflow-hidden animate-pulse">
          <div className="aspect-square bg-gray-200 dark:bg-night-700" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-night-700 rounded w-2/3" />
            <div className="h-3 bg-gray-200 dark:bg-night-700 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
