import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useToast } from '../components/Toast.jsx';

export default function Signup() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    userType: 'vendor',
    location: '',
    businessName: '',
  });
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setRole = (role) => setForm((f) => ({ ...f, userType: role }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/register', form);
      toast.success('Account created! Please sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="card p-6 sm:p-8">
        <h1 className="font-display text-3xl text-ink dark:text-gray-100">Join VendorVerse</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Create an account to start ordering or selling.</p>

        {/* Role toggle */}
        <div className="mt-6 grid grid-cols-2 gap-2 p-1 bg-brand-50 dark:bg-night-700 rounded-xl">
          {[
            { v: 'vendor',   label: 'I’m a Vendor',   sub: 'Buy ingredients' },
            { v: 'supplier', label: 'I’m a Supplier', sub: 'Sell ingredients' },
          ].map((r) => {
            const active = form.userType === r.v;
            return (
              <button
                key={r.v}
                type="button"
                onClick={() => setRole(r.v)}
                className={
                  'rounded-lg p-3 text-left transition ' +
                  (active
                    ? 'bg-white dark:bg-night-800 shadow-card text-brand-700 dark:text-brand-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-night-800/60')
                }
              >
                <div className="font-medium text-sm">{r.label}</div>
                <div className="text-xs opacity-75">{r.sub}</div>
              </button>
            );
          })}
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" required className="input" value={form.name} onChange={update('name')} />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required autoComplete="email" className="input" value={form.email} onChange={update('email')} />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={6} autoComplete="new-password" className="input" value={form.password} onChange={update('password')} />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">At least 6 characters.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="location">Location</label>
              <input id="location" required placeholder="City / area" className="input" value={form.location} onChange={update('location')} />
            </div>
            <div>
              <label className="label" htmlFor="businessName">
                Business name {form.userType === 'vendor' && <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>}
              </label>
              <input
                id="businessName"
                placeholder={form.userType === 'supplier' ? 'Your supply business' : 'Your stall name'}
                className="input"
                value={form.businessName} onChange={update('businessName')}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-gray-600 dark:text-gray-400 mt-6 text-center">
          Already have an account? <Link to="/login" className="text-brand-700 dark:text-brand-300 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
