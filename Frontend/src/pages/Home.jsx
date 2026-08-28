import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import api from '../api.js';
import { perUnit, CATEGORIES } from '../format.js';
import { CATEGORY_TONES } from '../components/ui/Thumb.jsx';

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Home() {
  const { user } = useAuth();
  const ctaHref = user ? (user.userType === 'supplier' ? '/supplier' : '/vendor') : '/signup';
  const ctaLabel = user ? 'Open Dashboard' : 'Get Started';

  // Live proof for the hero, the ticker and the bento tiles. If the request
  // fails the page simply renders without live numbers — never with fake ones.
  const [live, setLive] = useState(null);
  useEffect(() => {
    let on = true;
    api.get('/landing')
      .then(({ data }) => { if (on && data.items > 0) setLive(data); })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  return (
    <div>
      <Hero user={user} ctaHref={ctaHref} ctaLabel={ctaLabel} live={live} />
      {live?.ticker?.length > 3 && <Ticker items={live.ticker} />}
      <Categories live={live} href={ctaHref} />
      <ScrollStory />
      <Compare />
      <Bento live={live} />

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 mt-20 mb-20">
        <h2 className="font-display text-3xl text-center text-ink dark:text-gray-100">Frequently asked</h2>
        <div className="mt-6 space-y-3">
          {FAQS.map((f) => <Faq key={f.q} {...f} />)}
        </div>
      </section>

      <CtaBand user={user} ctaHref={ctaHref} />
    </div>
  );
}

/* ── Category showcase ───────────────────────────────────────────────── */

function Categories({ live, href }) {
  const counts = Object.fromEntries((live?.categories || []).map((c) => [c.category, c.items]));
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-20">
      <h2 className="font-display text-3xl sm:text-4xl text-center text-ink dark:text-gray-100">Stocked every morning</h2>
      <p className="text-center text-gray-600 dark:text-gray-400 mt-2">From fresh produce to pantry staples, priced per unit.</p>
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {CATEGORIES.map((c) => (
          <Link key={c} to={href} className="card card-lift p-4 text-center block">
            <div className={`h-12 w-12 mx-auto rounded-lg grid place-items-center text-lg font-semibold ${CATEGORY_TONES[c]}`}>
              {c[0].toUpperCase()}
            </div>
            <div className="mt-3 text-sm font-medium text-ink dark:text-gray-100 capitalize">{c}</div>
            {counts[c] > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5"><span className="tnum">{counts[c]}</span> items live</div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── The old way vs VendorVerse ──────────────────────────────────────── */

const COMPARE_ROWS = [
  ['Call five suppliers to compare one price', 'Every price per kg, cheapest offer first'],
  ['Order by phone tag at 5 a.m.', 'One cart across suppliers, placed in a tap'],
  ['"Is it coming?" calls all morning', 'Live status from accepted to delivered'],
  ['Prices remembered, never written down', 'Every order and total in your history'],
];

function Compare() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-20">
      <h2 className="font-display text-3xl sm:text-4xl text-center text-ink dark:text-gray-100">Mornings, before and after</h2>
      <div className="mt-8 grid md:grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-4">The old way</h3>
          <ul className="space-y-3">
            {COMPARE_ROWS.map(([old]) => (
              <li key={old} className="flex gap-3 text-gray-600 dark:text-gray-400">
                <svg className="shrink-0 mt-1 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                <span>{old}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6 border-brand-200 bg-brand-50/60 dark:border-brand-500/30 dark:bg-brand-500/5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-brand-700 dark:text-brand-400 mb-4">With VendorVerse</h3>
          <ul className="space-y-3">
            {COMPARE_ROWS.map(([, now]) => (
              <li key={now} className="flex gap-3 text-ink dark:text-gray-100">
                <svg className="shrink-0 mt-1 text-brand-600 dark:text-brand-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                <span>{now}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── Closing CTA band ────────────────────────────────────────────────── */

function CtaBand({ user, ctaHref }) {
  return (
    <section className="border-t border-brand-100 bg-brand-50 dark:border-night-700 dark:bg-night-800/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="font-display text-3xl sm:text-4xl text-ink dark:text-gray-100">Restock in under three minutes.</h2>
        <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          Free during beta, no commission — pay the supplier when the order arrives.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {user ? (
            <Link to={ctaHref} className="btn-primary">Open Dashboard</Link>
          ) : (
            <>
              <Link to="/signup" className="btn-primary">I buy ingredients</Link>
              <Link to="/signup" className="btn-ghost">I sell ingredients</Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Hero: kinetic headline · rotating word · count-up proof · tilt card ── */

const ROTATOR_WORDS = ['onions', 'प्याज़', 'tomatoes', 'paneer'];

function Hero({ user, ctaHref, ctaLabel, live }) {
  const zoneRef = useRef(null);
  const floatRefs = useRef([]);

  // The parallax garnish follows the pointer; transforms are written straight
  // to the nodes so nothing re-renders per frame.
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone || !window.matchMedia('(hover: hover)').matches || reducedMotion()) return;
    const move = (e) => {
      const r = zone.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      floatRefs.current.forEach((el, i) => {
        if (!el) return;
        const d = 4 + i * 3;
        el.style.transform = `translate(${-x * d * 4}px, ${-y * d * 4}px)`;
      });
    };
    zone.addEventListener('mousemove', move);
    return () => zone.removeEventListener('mousemove', move);
  }, []);

  return (
    <section ref={zoneRef} className="relative overflow-hidden border-b border-brand-100 bg-brand-50 dark:border-night-700 dark:bg-night-800/50">
      {/* Parallax garnish — desktop only, quiet enough to sit behind the type. */}
      <div aria-hidden className="hidden lg:block">
        {['🧅', '🍅', '🌶️'].map((g, i) => (
          <span
            key={g}
            ref={(el) => { floatRefs.current[i] = el; }}
            className="absolute text-3xl opacity-30 select-none transition-transform duration-150 ease-out"
            style={[{ top: '14%', left: '4%' }, { bottom: '16%', left: '42%' }, { top: '10%', right: '6%' }][i]}
          >
            {g}
          </span>
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
            For Indian street food vendors &amp; suppliers
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tighter leading-[1.08] text-ink dark:text-gray-100">
            <span className="hero-line"><span className="hero-word" style={{ '--d': '60ms' }}>Fresh <Rotator words={ROTATOR_WORDS} /></span></span>
            <span className="hero-line"><span className="hero-word" style={{ '--d': '160ms' }}>at the best price,</span></span>
            <span className="hero-line"><span className="hero-word text-brand-700 dark:text-brand-400" style={{ '--d': '280ms' }}>delivered to your stall.</span></span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-md">
            Compare prices per kilo before you order, then track every delivery live — no phone calls.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={ctaHref} className="btn-primary">
              {ctaLabel}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </Link>
            {!user && (
              <Link to="/login" className="btn-ghost">
                I already have an account
              </Link>
            )}
          </div>
          {live && (
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-2 align-middle" aria-hidden />
              <CountUp value={live.suppliers} className="font-semibold text-ink dark:text-gray-100" /> suppliers
              {' · '}
              <CountUp value={live.items} className="font-semibold text-ink dark:text-gray-100" /> items live
              {live.cities > 1 && <>
                {' · '}
                <CountUp value={live.cities} className="font-semibold text-ink dark:text-gray-100" /> cities
              </>}
            </p>
          )}
        </div>

        <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 dark:border-night-600">
          <img src="/home/tractor.jpg" alt="Fresh from the farm" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <p className="text-xs uppercase tracking-wider opacity-80">Today on the platform</p>
            <p className="text-xl font-medium tracking-tight">Farm-fresh ingredients, delivered direct.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// One word cycles through what vendors actually buy — Hindi included. The
// remount per word replays the bump-up entrance.
function Rotator({ words }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const t = setInterval(() => setI((n) => (n + 1) % words.length), 2600);
    return () => clearInterval(t);
  }, [words.length]);
  return (
    <span className="inline-block min-w-[4.5ch] text-brand-700 dark:text-brand-400">
      <span key={i} className="inline-block animate-bump-up">{words[i]}</span>
    </span>
  );
}

// Counts up once, when the value first arrives.
function CountUp({ value, className = '' }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const dur = reducedMotion() ? 0 : 900;
    const tick = (t) => {
      const p = dur === 0 ? 1 : Math.min((t - t0) / dur, 1);
      setN(Math.round(value * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={`tnum ${className}`}>{n.toLocaleString('en-IN')}</span>;
}

/* ── Live price strip ────────────────────────────────────────────────── */

function Ticker({ items }) {
  // The list renders twice; the track slides exactly one list-width.
  const list = (key) => (
    <div key={key} className="flex" aria-hidden={key === 'b'}>
      {items.map((it) => (
        <span key={key + it.name} className="inline-flex items-baseline gap-2 mx-6 text-sm whitespace-nowrap">
          <span className="font-medium text-ink dark:text-gray-100">{it.name}</span>
          <span className="tnum font-semibold text-brand-700 dark:text-brand-400">{perUnit(it.price, it.unit)}</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="ticker-band overflow-hidden border-b border-gray-200 bg-white py-3 dark:bg-night-800 dark:border-night-700">
      <div className="ticker-track">{list('a')}{list('b')}</div>
    </div>
  );
}

/* ── Scroll story: Browse → Order → Track with a morphing phone ─────── */

const STEPS = [
  ['Browse', 'Live stock and price per kg from suppliers near you — the cheapest offer leads every group.'],
  ['Order', 'One cart across many suppliers. Pick the quantity, place it in a tap, pay cash on delivery.'],
  ['Track', 'Accepted, packed, out for delivery, delivered — the status advances live, without a phone call.'],
];

function ScrollStory() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number(e.target.dataset.step));
        });
      },
      { rootMargin: '-40% 0px -40% 0px' },
    );
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-20">
      <h2 className="font-display text-3xl sm:text-4xl text-center text-ink dark:text-gray-100">How it works</h2>
      <p className="text-center text-gray-600 dark:text-gray-400 mt-2">From mandi to your tawa, in three steps.</p>

      <div className="mt-10 grid md:grid-cols-2 gap-10">
        <div>
          {STEPS.map(([t, d], i) => (
            <div
              key={t}
              ref={(el) => { stepRefs.current[i] = el; }}
              data-step={i}
              className={
                'border-l-2 pl-5 py-8 md:py-16 transition-all duration-500 ' +
                (active === i
                  ? 'border-brand-600 opacity-100 dark:border-brand-400'
                  : 'border-gray-200 opacity-40 dark:border-night-600')
              }
            >
              <div className="text-sm font-semibold text-brand-700 dark:text-brand-400 mb-1">Step {i + 1}</div>
              <h3 className="text-xl font-semibold text-ink dark:text-gray-100">{t}</h3>
              <p className="mt-1 text-gray-600 dark:text-gray-400 max-w-sm">{d}</p>
            </div>
          ))}
        </div>
        <div className="hidden md:block">
          <div className="sticky top-28 grid place-items-center">
            <PhoneMock active={active} />
          </div>
        </div>
      </div>
    </section>
  );
}

// Three screens stacked in one frame; the active one fades and rises in.
function PhoneMock({ active }) {
  const screen = (i, children) => (
    <div
      className={
        'absolute inset-0 p-4 transition-all duration-500 ' +
        (active === i ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none')
      }
    >
      {children}
    </div>
  );
  const row = (name, price, hl = false) => (
    <div className={'flex justify-between items-center px-3 py-2.5 rounded-md text-sm mb-2 ' + (hl ? 'bg-brand-50 dark:bg-brand-500/10' : 'bg-gray-50 dark:bg-night-700')}>
      <span className="text-ink dark:text-gray-100">{name}</span>
      <span className="tnum font-semibold text-ink dark:text-gray-100">{price}</span>
    </div>
  );

  return (
    <div className="relative w-64 h-[420px] rounded-[24px] border-2 border-gray-300 bg-white overflow-hidden dark:border-night-500 dark:bg-night-800" aria-hidden>
      <div className="h-8 border-b border-gray-100 dark:border-night-700 grid place-items-center text-[10px] font-semibold tracking-[0.14em] text-gray-400 uppercase">VendorVerse</div>
      <div className="relative h-[calc(100%-2rem)]">
        {screen(0, <>
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Onion · 3 suppliers</div>
          {row('Sharma Traders', '₹32/kg', true)}
          {row('Kisan Supply', '₹34/kg')}
          {row('Mandi Direct', '₹35/kg')}
          <div className="text-[11px] text-brand-700 dark:text-brand-400 font-medium px-3">cheapest first</div>
        </>)}
        {screen(1, <>
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Cart · 2 suppliers</div>
          {row('Onion · 25 kg', '₹800')}
          {row('Tomato · 10 kg', '₹410')}
          <div className="flex justify-between px-3 py-2 text-sm font-semibold text-ink dark:text-gray-100">
            <span>Total</span><span className="tnum">₹1,210</span>
          </div>
          <div className="mx-3 mt-2 h-10 rounded-md bg-brand-600 dark:bg-brand-500 grid place-items-center text-white text-sm font-medium">Place order</div>
        </>)}
        {screen(2, <>
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">Order · ₹1,210</div>
          {['Pending', 'Accepted', 'Packed', 'Out for delivery', 'Delivered'].map((s, i) => (
            <div key={s} className="flex items-center gap-3 mb-3">
              <span className={'h-3 w-3 rounded-full transition-colors duration-500 ' + (i <= (active === 2 ? 3 : 0) ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-night-600')} style={{ transitionDelay: `${i * 140}ms` }} />
              <span className={'text-sm transition-colors duration-500 ' + (i <= 3 ? 'text-ink dark:text-gray-100' : 'text-gray-400')}>{s}</span>
            </div>
          ))}
        </>)}
      </div>
    </div>
  );
}

/* ── Bento grid ──────────────────────────────────────────────────────── */

function Bento({ live }) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-20">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card card-lift p-5 md:row-span-2 col-span-2 md:col-span-1">
          <h3 className="font-semibold text-ink dark:text-gray-100">Compare per kg</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-4">Same item, every supplier, sorted by price. The cheapest offer always leads.</p>
          {(live?.ticker?.slice(0, 3) || []).map((it, i) => (
            <div key={it.name} className={'flex justify-between items-center px-3 py-2 rounded-md text-sm mb-2 ' + (i === 0 ? 'bg-brand-50 dark:bg-brand-500/10' : 'bg-gray-50 dark:bg-night-700')}>
              <span className="text-ink dark:text-gray-100 capitalize">{it.name}</span>
              <span className="tnum font-semibold text-ink dark:text-gray-100">{perUnit(it.price, it.unit)}</span>
            </div>
          ))}
        </div>
        <div className="card card-lift p-5 col-span-2">
          <h3 className="font-semibold text-ink dark:text-gray-100">Track every order</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">Live status from the supplier's hands to yours.</p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {['Pending', 'Accepted', 'Packed', 'Out', 'Delivered'].map((s, i, a) => (
              <span key={s} className="inline-flex items-center gap-2">
                <span className={'px-2.5 py-1 rounded-md ' + (i === a.length - 1 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-night-700 dark:text-gray-300')}>{s}</span>
                {i < a.length - 1 && <span className="text-gray-300 dark:text-night-500">→</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="card card-lift p-5">
          {live
            ? <><div className="font-display text-3xl text-brand-700 dark:text-brand-400"><CountUp value={live.suppliers} /></div><div className="text-sm text-gray-600 dark:text-gray-400 mt-1">suppliers on the platform</div></>
            : <><div className="font-display text-3xl text-brand-700 dark:text-brand-400">Free</div><div className="text-sm text-gray-600 dark:text-gray-400 mt-1">during beta — no commission</div></>}
        </div>
        <div className="card card-lift p-5">
          {live
            ? <><div className="font-display text-3xl text-brand-700 dark:text-brand-400"><CountUp value={live.items} /></div><div className="text-sm text-gray-600 dark:text-gray-400 mt-1">items listed right now</div></>
            : <><div className="font-display text-3xl text-brand-700 dark:text-brand-400">Direct</div><div className="text-sm text-gray-600 dark:text-gray-400 mt-1">no middleman between you and the supplier</div></>}
        </div>
        <div className="card card-lift p-5 col-span-2">
          <h3 className="font-semibold text-ink dark:text-gray-100">Pay on delivery</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Cash to the supplier when the order arrives. No wallets, no advance, no commission during beta.</p>
        </div>
        <Link to="/signup" className="card card-lift p-5 block group">
          <h3 className="font-semibold text-ink dark:text-gray-100">Selling ingredients?</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">List stock in seconds, take orders without phone tag.</p>
          <span className="inline-block mt-2 text-sm font-medium text-brand-700 dark:text-brand-400 group-hover:translate-x-0.5 transition-transform">Become a supplier →</span>
        </Link>
      </div>
    </section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────────────── */

const FAQS = [
  { q: 'Is VendorVerse free to use?', a: 'Yes — both vendors and suppliers can sign up and use the platform free of charge during our beta.' },
  { q: 'How do I pay for orders?', a: 'Right now orders are pay-on-delivery, with the supplier directly. Online payments via UPI are coming soon.' },
  { q: 'Can a supplier deliver outside their city?', a: 'That is between you and the supplier for now. Each listing shows the supplier location, and you can leave delivery instructions at checkout. Automatic matching by area is on our roadmap.' },
  { q: 'How are prices set?', a: 'Suppliers set their own prices. Vendors can compare suppliers side-by-side to find the best deal.' },
  { q: 'What if I have an issue with an order?', a: 'A vendor can cancel while the order is still Pending, and a supplier can reject it from their dashboard. After that, reach us through the Help page so we can mediate.' },
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
