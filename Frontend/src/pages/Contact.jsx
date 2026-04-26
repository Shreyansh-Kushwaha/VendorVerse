import { useState } from 'react';
import { useToast } from '../components/Toast.jsx';

export default function Contact() {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    // No email backend wired yet — open the user's mail client as a graceful fallback
    const body = encodeURIComponent(`From: ${form.name} <${form.email}>\n\n${form.message}`);
    const subject = encodeURIComponent(form.subject || 'VendorVerse enquiry');
    window.location.href = `mailto:hello@vendorverse.app?subject=${subject}&body=${body}`;
    toast.success('Opening your email app…');
    setSent(true);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid md:grid-cols-[1fr_280px] gap-8">
      <section>
        <h1 className="font-display text-4xl text-ink dark:text-gray-100">Get in touch</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Questions, feedback, partnership — drop us a note.
        </p>

        <form onSubmit={submit} className="card p-5 mt-6 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input required className="input" value={form.name} onChange={update('name')} />
            </div>
            <div>
              <label className="label">Email</label>
              <input required type="email" className="input" value={form.email} onChange={update('email')} />
            </div>
          </div>
          <div>
            <label className="label">Subject</label>
            <input className="input" value={form.subject} onChange={update('subject')} />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea required className="input min-h-[120px]" value={form.message} onChange={update('message')} />
          </div>
          <button className="btn-primary w-full" type="submit">{sent ? 'Send another' : 'Send message'}</button>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            We'll connect you with our team via email.
          </p>
        </form>
      </section>

      <aside className="card p-5 h-fit">
        <h2 className="font-display text-xl text-ink dark:text-gray-100">Other ways</h2>
        <ul className="mt-3 space-y-3 text-sm">
          <li>
            <div className="text-xs text-gray-500 dark:text-gray-400">Email</div>
            <a className="text-brand-700 dark:text-brand-400 hover:underline" href="mailto:hello@vendorverse.app">hello@vendorverse.app</a>
          </li>
          <li>
            <div className="text-xs text-gray-500 dark:text-gray-400">Help center</div>
            <a className="text-brand-700 dark:text-brand-400 hover:underline" href="/help">Browse common questions</a>
          </li>
        </ul>
      </aside>
    </div>
  );
}
