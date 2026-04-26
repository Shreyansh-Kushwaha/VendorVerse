import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Home() {
  const { user } = useAuth();
  const ctaHref = user ? (user.userType === 'supplier' ? '/supplier' : '/vendor') : '/signup';
  const ctaLabel = user ? 'Open Dashboard' : 'Get Started';

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500 via-brand-400 to-brand-600" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-black/10 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div className="text-white">
            <span className="inline-block bg-white/15 backdrop-blur px-3 py-1 rounded-full text-xs font-medium mb-4">
              For Indian street food vendors & suppliers
            </span>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[0.95] drop-shadow-md">
              pure<br/>&amp; fresh
            </h1>
            <p className="mt-5 text-base sm:text-lg text-white/90 max-w-md">
              VendorVerse connects vendors directly with trusted local suppliers — discover, compare and order raw ingredients in minutes.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={ctaHref} className="btn bg-white text-brand-700 hover:bg-brand-50 shadow-pop">
                {ctaLabel}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </Link>
              {!user && (
                <Link to="/login" className="btn bg-white/10 text-white border border-white/30 hover:bg-white/20">
                  I already have an account
                </Link>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-white/10 rounded-3xl blur-2xl" />
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-pop ring-4 ring-white/30">
              <img src="/home/tractor.jpg" alt="Fresh from the farm" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="text-xs uppercase tracking-wider opacity-80">Today on the platform</p>
                <p className="font-display text-2xl">Farm-fresh ingredients, delivered direct.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-10 relative z-10">
        <div className="card grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 dark:divide-night-700">
          {[
            { v: '1,200+', l: 'Vendors served' },
            { v: '350+',   l: 'Suppliers onboarded' },
            { v: '15k+',   l: 'Orders fulfilled' },
            { v: '4.7★',   l: 'Average rating' },
          ].map((s) => (
            <div key={s.l} className="p-5 text-center">
              <div className="font-display text-2xl sm:text-3xl text-brand-600 dark:text-brand-400">{s.v}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-14">
        <h2 className="font-display text-3xl sm:text-4xl text-center text-ink dark:text-gray-100">How it works</h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mt-2">Two roles. One marketplace.</p>
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <RoleCard
            title="For vendors"
            color="from-brand-500 to-brand-600"
            steps={[
              ['Browse', 'Discover suppliers near you with live inventory and prices.'],
              ['Add to cart', 'Pick items from one or many suppliers in a single order.'],
              ['Track', 'Watch your order move from accepted to delivered in real time.'],
            ]}
          />
          <RoleCard
            title="For suppliers"
            color="from-emerald-500 to-emerald-600"
            steps={[
              ['List inventory', 'Add items with photos, price and quantity in seconds.'],
              ['Receive orders', 'Vendors place orders directly — no phone tag.'],
              ['Fulfill', 'Mark accepted, packed, out for delivery, delivered.'],
            ]}
          />
        </div>
      </section>

      {/* Feature strip */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-14">
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { t: 'Discover', d: 'Browse trusted suppliers near you with prices, locations and live inventory.' },
            { t: 'Compare', d: 'Filter by category and search items in seconds — no more phone calls.' },
            { t: 'Order',    d: 'Place multi-supplier orders with one tap and track them right from your dashboard.' },
          ].map((f) => (
            <div key={f.t} className="card p-5">
              <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 dark:bg-night-700 dark:text-brand-300 grid place-items-center font-bold mb-3">{f.t[0]}</div>
              <h3 className="font-display text-xl text-ink dark:text-gray-100">{f.t}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-14">
        <h2 className="font-display text-3xl text-center text-ink dark:text-gray-100">What people say</h2>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {[
            { q: '“Saved me 2 hours every morning. I just open the app and reorder my usual.”', n: 'Ramesh', r: 'Pani Puri stall, Mumbai' },
            { q: '“The price comparison is gold. Got onions for ₹8 less per kg this week.”', n: 'Sunita', r: 'Chaat corner, Pune' },
            { q: '“As a supplier, I now get orders without the back-and-forth on WhatsApp.”', n: 'Imran', r: 'Vegetable wholesaler, Delhi' },
          ].map((t) => (
            <figure key={t.n} className="card p-5">
              <blockquote className="text-gray-700 dark:text-gray-300 italic">{t.q}</blockquote>
              <figcaption className="mt-3 text-sm">
                <div className="font-medium text-ink dark:text-gray-100">{t.n}</div>
                <div className="text-gray-500 dark:text-gray-400">{t.r}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 mt-14">
        <div className="card p-6 sm:p-8">
          <h2 className="font-display text-2xl sm:text-3xl text-brand-600 dark:text-brand-400 mb-3">VendorVerse: Powering Street Food Dreams</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            Welcome to <strong>VendorVerse</strong>, where passion meets procurement. Our platform connects{' '}
            <em>street food vendors</em> with trusted <strong>raw material suppliers</strong> — making it easier than ever to:
          </p>
          <ul className="mt-3 space-y-1.5">
            {['Discover suppliers', 'Compare prices', 'Place orders directly'].map((l) => (
              <li key={l} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                <span className="text-brand-600 dark:text-brand-400 mt-0.5">•</span><span>{l}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-gray-700 dark:text-gray-300 leading-relaxed">
            From fresh veggies to essential ingredients, find everything you need in one place — fast, reliable, and at the best price.
            Let your flavors shine. Let <strong>VendorVerse</strong> fuel your cart.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 mt-14 mb-14">
        <h2 className="font-display text-3xl text-center text-ink dark:text-gray-100">Frequently asked</h2>
        <div className="mt-6 space-y-3">
          {FAQS.map((f) => <Faq key={f.q} {...f} />)}
        </div>
      </section>
    </div>
  );
}

function RoleCard({ title, color, steps }) {
  return (
    <div className="card overflow-hidden">
      <div className={`h-2 bg-gradient-to-r ${color}`} />
      <div className="p-6">
        <h3 className="font-display text-2xl text-ink dark:text-gray-100">{title}</h3>
        <ol className="mt-4 space-y-4">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="h-7 w-7 rounded-full bg-brand-50 text-brand-700 dark:bg-night-700 dark:text-brand-300 grid place-items-center text-sm font-semibold shrink-0">{i + 1}</span>
              <div>
                <div className="font-medium text-ink dark:text-gray-100">{t}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const FAQS = [
  { q: 'Is VendorVerse free to use?', a: 'Yes — both vendors and suppliers can sign up and use the platform free of charge during our beta.' },
  { q: 'How do I pay for orders?', a: 'Right now orders are pay-on-delivery, with the supplier directly. Online payments via UPI are coming soon.' },
  { q: 'Can a supplier deliver outside their city?', a: 'It depends on the supplier. Each supplier sets their own delivery range, listed on their profile.' },
  { q: 'How are prices set?', a: 'Suppliers set their own prices. Vendors can compare suppliers side-by-side to find the best deal.' },
  { q: 'What if I have an issue with an order?', a: 'You can reject the order from your dashboard, or contact us through the Help page so we can mediate.' },
];

function Faq({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <span className="font-medium text-ink dark:text-gray-100">{q}</span>
        <svg
          className={'shrink-0 text-brand-600 dark:text-brand-400 transition-transform ' + (open ? 'rotate-180' : '')}
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        ><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div className={'px-4 overflow-hidden transition-[max-height,padding] duration-300 ease-in-out ' + (open ? 'max-h-40 pb-4' : 'max-h-0')}>
        <p className="text-sm text-gray-600 dark:text-gray-400">{a}</p>
      </div>
    </div>
  );
}
