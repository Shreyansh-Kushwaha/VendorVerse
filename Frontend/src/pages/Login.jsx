import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/login', form);
      login(data.user);
      toast.success('Welcome back!');
      const dest = data.userType === 'supplier' ? '/supplier' : '/vendor';
      navigate(location.state?.from?.pathname || dest, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="card p-6 sm:p-8">
        <h1 className="font-display text-3xl text-ink dark:text-gray-100">Welcome back</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Log in to continue ordering or fulfilling.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email" type="email" required autoComplete="email"
              className="input" placeholder="you@example.com"
              value={form.email} onChange={update('email')}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password" type="password" required autoComplete="current-password"
              className="input" placeholder="••••••••"
              value={form.password} onChange={update('password')}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-sm text-gray-600 dark:text-gray-400 mt-6 text-center">
          New here? <Link to="/signup" className="text-brand-700 dark:text-brand-300 font-medium hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
