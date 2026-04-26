import { useState } from 'react';
import { Link } from 'react-router-dom';

const TOPICS = [
  {
    cat: 'Getting started',
    items: [
      ['How do I sign up?', 'Click "Get started" on the home page, choose Vendor or Supplier, and fill in your details. Vendors can place orders immediately; suppliers need to add their first inventory item before they appear in search.'],
      ['Can I switch between Vendor and Supplier accounts?', 'Each account is one role. If you need both, create separate accounts with different emails for now.'],
    ],
  },
  {
    cat: 'Orders',
    items: [
      ['How do I place an order?', 'Browse items on your dashboard, click "Add to cart", review your cart and tap Checkout. You can place orders to multiple suppliers in one go.'],
      ['How do I track an order?', 'From your dashboard, click any order in "My orders" to see a live status timeline.'],
      ['Can I cancel an order?', 'Yes — only while the order is still Pending. Once a supplier accepts, you need to contact them via the Help page to cancel.'],
    ],
  },
  {
    cat: 'Inventory (suppliers)',
    items: [
      ['How do I add an item?', 'On your dashboard, tap "Add inventory" and fill in the item details, including a clear photo (max 5 MB).'],
      ['How do I edit price or quantity?', 'Tap any item card to open the edit modal — you can update price, quantity, name and category, or delete the item.'],
      ['How do low-stock badges work?', 'Items with 5 or fewer in stock get a LOW badge; 0 stock shows OUT.'],
    ],
  },
  {
    cat: 'Account',
    items: [
      ['How do I change my password?', 'Profile → Change password. You\'ll need to enter your current password to confirm.'],
      ['How do I delete my account?', 'Profile → Delete account. You\'ll need to type DELETE and re-enter your password. This permanently removes your data, inventory and orders.'],
    ],
  },
];

export default function Help() {
  const [q, setQ] = useState('');

  const filtered = TOPICS.map(c => ({
    ...c,
    items: c.items.filter(([qst, ans]) =>
      !q || qst.toLowerCase().includes(q.toLowerCase()) || ans.toLowerCase().includes(q.toLowerCase())
    ),
  })).filter(c => c.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="font-display text-4xl text-ink dark:text-gray-100">Help center</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-2">Quick answers to common questions.</p>

      <div className="card p-3 mt-6">
        <input
          className="input"
          placeholder="Search help articles…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="mt-6 space-y-6">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No matching articles. Try a different search or <Link className="text-brand-700 dark:text-brand-400 hover:underline" to="/contact">contact us</Link>.</p>
        )}
        {filtered.map((cat) => (
          <section key={cat.cat}>
            <h2 className="font-display text-2xl text-brand-600 dark:text-brand-400">{cat.cat}</h2>
            <div className="mt-3 space-y-2">
              {cat.items.map(([qst, ans]) => <Item key={qst} q={qst} a={ans} />)}
            </div>
          </section>
        ))}
      </div>

      <div className="card p-5 mt-10 text-center">
        <h3 className="font-display text-xl text-ink dark:text-gray-100">Still need help?</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">We usually reply within a day.</p>
        <Link to="/contact" className="btn-primary mt-4 inline-flex">Contact us</Link>
      </div>
    </div>
  );
}

function Item({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button
        className="w-full text-left p-4 flex items-start justify-between gap-3"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="font-medium text-ink dark:text-gray-100">{q}</span>
        <svg className={'shrink-0 text-brand-600 dark:text-brand-400 transition-transform ' + (open ? 'rotate-180' : '')} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div className={'px-4 overflow-hidden transition-[max-height,padding] duration-300 ease-in-out ' + (open ? 'max-h-60 pb-4' : 'max-h-0')}>
        <p className="text-sm text-gray-600 dark:text-gray-400">{a}</p>
      </div>
    </div>
  );
}
