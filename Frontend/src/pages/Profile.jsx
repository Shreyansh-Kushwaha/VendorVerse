import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';

export default function Profile() {
  const { user, login, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  if (!user) return null;

  const initials = (user.name || '?')
    .split(' ').filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('');

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="card overflow-hidden">
        <div className="h-28 bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600" />
        <div className="px-6 sm:px-8 pb-8 -mt-12">
          <div className="h-24 w-24 rounded-2xl bg-white dark:bg-night-700 shadow-pop ring-4 ring-white dark:ring-night-800 grid place-items-center font-display text-3xl text-brand-700 dark:text-brand-300">
            {initials}
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl text-ink dark:text-gray-100">{user.name}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="capitalize">{user.userType}</span> · {user.location}
              </p>
            </div>
            <button onClick={() => setEditOpen(true)} className="btn-ghost">Edit profile</button>
          </div>

          <dl className="mt-6 grid sm:grid-cols-2 gap-4">
            <Field label="Email" value={user.email} />
            <Field label="Business" value={user.businessName || '—'} />
            <Field label="Member since" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'} />
            <Field label="Account type" value={user.userType} capitalize />
          </dl>

          <div className="mt-8 grid sm:grid-cols-2 gap-3">
            <button onClick={() => setPwOpen(true)} className="btn-ghost">Change password</button>
            <button
              onClick={() => navigate(user.userType === 'supplier' ? '/supplier' : '/vendor')}
              className="btn-primary"
            >
              Back to dashboard
            </button>
            <button onClick={handleLogout} className="btn-ghost text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10">Log out</button>
            <button onClick={() => setDelOpen(true)} className="btn-danger">Delete account</button>
          </div>
        </div>
      </div>

      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} user={user} onSaved={(u) => { login(u); toast.success('Profile updated'); }} />
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} userId={user._id} />
      <DeleteAccountModal open={delOpen} onClose={() => setDelOpen(false)} userId={user._id} onDeleted={() => { logout(); navigate('/'); }} />
    </div>
  );
}

function Field({ label, value, capitalize }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 dark:border-night-700 dark:bg-night-900/40 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={'mt-0.5 text-ink dark:text-gray-100 font-medium ' + (capitalize ? 'capitalize' : '')}>{value}</dd>
    </div>
  );
}

function EditProfileModal({ open, onClose, user, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, location: user.location, businessName: user.businessName || '' });
  const [busy, setBusy] = useState(false);
  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/users/${user._id}`, form);
      onSaved({ ...user, ...data.user });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Edit profile"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.name} onChange={update('name')} />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={form.location} onChange={update('location')} />
        </div>
        <div>
          <label className="label">Business name</label>
          <input className="input" value={form.businessName} onChange={update('businessName')} />
        </div>
      </div>
    </Modal>
  );
}

function ChangePasswordModal({ open, onClose, userId }) {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (form.newPassword !== form.confirm) return toast.error("Passwords don't match");
    if (form.newPassword.length < 6) return toast.error('New password must be 6+ chars');
    setBusy(true);
    try {
      await api.patch(`/users/${userId}/password`, {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password updated');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to update password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Change password"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Current password</label>
          <input type="password" autoComplete="current-password" className="input" value={form.currentPassword} onChange={update('currentPassword')} />
        </div>
        <div>
          <label className="label">New password</label>
          <input type="password" autoComplete="new-password" className="input" value={form.newPassword} onChange={update('newPassword')} />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input type="password" autoComplete="new-password" className="input" value={form.confirm} onChange={update('confirm')} />
        </div>
      </div>
    </Modal>
  );
}

function DeleteAccountModal({ open, onClose, userId, onDeleted }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const ready = confirm === 'DELETE' && password.length > 0;

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/users/${userId}`, { data: { password } });
      toast.success('Account deleted');
      onDeleted();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Delete account"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-danger" onClick={doDelete} disabled={!ready || busy}>{busy ? 'Deleting…' : 'Permanently delete'}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/30 p-3 text-sm text-red-700 dark:text-red-300">
          This will delete your account, inventory, and orders. This action cannot be undone.
        </div>
        <div>
          <label className="label">Type DELETE to confirm</label>
          <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
        </div>
        <div>
          <label className="label">Your password</label>
          <input type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
