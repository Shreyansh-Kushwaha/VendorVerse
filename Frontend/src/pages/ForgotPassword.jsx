import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { useToast } from '../components/Toast.jsx';
import usePageMeta from '../lib/meta.js';

export default function ForgotPassword() {
  usePageMeta({
    title: 'Recover',
    description:
      'Forgot your VendorVerse password? Enter your email and we will send you a link to set a new one.',
  });
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post('/forgot-password', { email });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not send the reset link');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="card p-6 sm:p-8">
        <h1 className="font-display text-3xl text-ink dark:text-gray-100">Forgot your password?</h1>

        {sent ? (
          <>
            <div className="mt-6 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/30 p-4 text-sm text-emerald-800 dark:text-emerald-300">
              If <strong>{email}</strong> has an account, a reset link is on its way. It works for one hour.
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
              Nothing arrived? Check the spam folder, or{' '}
              <button className="text-brand-700 dark:text-brand-300 font-medium hover:underline" onClick={() => setSent(false)}>
                try another address
              </button>.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Enter the email you signed up with and we will send you a link to set a new one.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input
                  id="email" type="email" required autoComplete="email" autoFocus
                  className="input" value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={sending}>
                {sending ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}

        <p className="text-sm text-gray-600 dark:text-gray-400 mt-6 text-center">
          <Link to="/login" className="text-brand-700 dark:text-brand-300 font-medium hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
