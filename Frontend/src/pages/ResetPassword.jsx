import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api.js';
import { useToast } from '../components/Toast.jsx';
import usePageMeta from '../lib/meta.js';

export default function ResetPassword() {
  usePageMeta({
    title: 'Reset',
    description:
      'Choose a new password for your VendorVerse account.',
    noIndex: true,
  });
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error("Those two passwords don't match");
    setSaving(true);
    try {
      await api.post('/reset-password', { token, password: form.password });
      toast.success('Password updated, sign in with it now');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not reset the password');
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="font-display text-2xl text-ink dark:text-gray-100">This link is incomplete</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Open the link from your email, or ask for a new one.
        </p>
        <Link to="/forgot-password" className="btn-primary mt-6">Request a new link</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="card p-6 sm:p-8">
        <h1 className="font-display text-3xl text-ink dark:text-gray-100">Choose a new password</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Once you save it, you will be signed out everywhere else.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="password">New password</label>
            <input
              id="password" type="password" required minLength={6} autoComplete="new-password" autoFocus
              className="input" value={form.password} onChange={update('password')}
            />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">At least 6 characters.</p>
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm new password</label>
            <input
              id="confirm" type="password" required autoComplete="new-password"
              className="input" value={form.confirm} onChange={update('confirm')}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Save new password'}
          </button>
        </form>

        <p className="text-sm text-gray-600 dark:text-gray-400 mt-6 text-center">
          <Link to="/login" className="text-brand-700 dark:text-brand-300 font-medium hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
