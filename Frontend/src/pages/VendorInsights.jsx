import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { useToast } from '../components/Toast.jsx';
import Stat from '../components/ui/Stat.jsx';
import { money } from '../format.js';
import usePageMeta from '../lib/meta.js';

// Where the vendor's money actually goes: spend over two months, the items and
// suppliers behind it, and what the govt mandi says those kilos should cost.
export default function VendorInsights() {
  usePageMeta({
    title: 'Insights',
    description:
      'See where your raw material spend goes, month by month and supplier by supplier.',
    noIndex: true,
  });
  const toast = useToast();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let on = true;
    api.get('/vendor/insights')
      .then(({ data }) => { if (on) setData(data); })
      .catch(() => { if (on) { setFailed(true); toast.error('Could not load your insights'); } });
    return () => { on = false; };
  }, [toast]);

  if (failed) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-gray-500 sm:px-6 dark:text-gray-400">
        Insights are unavailable right now — try again in a bit.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Vendor</p>
          <h1 className="text-2xl tracking-tight text-ink dark:text-gray-100 sm:text-3xl">Your spending</h1>
        </div>
        <Link to="/vendor" className="btn-ghost self-start sm:self-auto">Back to dashboard</Link>
      </div>

      {!data ? (
        <div className="mt-6 space-y-4">
          <div className="skel h-24 rounded-xl" />
          <div className="skel h-56 rounded-xl" />
          <div className="skel h-40 rounded-xl" />
        </div>
      ) : data.totalOrders === 0 ? (
        <div className="card mt-6 p-10 text-center">
          <div className="font-medium text-ink dark:text-gray-100">Nothing to chart yet</div>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Your first order starts the story. Everything you buy shows up here.
          </p>
          <Link to="/vendor" className="btn-primary mt-4 inline-flex">Browse the catalog</Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total spend" value={money(data.totalSpend)} />
            <Stat label="Orders" value={data.totalOrders} />
            <Stat label="Suppliers" value={data.supplierCount} />
            <Stat label="Avg order" value={money(data.avgOrderValue)} />
          </div>

          <WeeklySpendChart weekly={data.weekly} />
          <TopItems items={data.topItems} />
          <TopSuppliers suppliers={data.topSuppliers} />
        </>
      )}
    </div>
  );
}

function WeeklySpendChart({ weekly }) {
  const max = Math.max(1, ...weekly.map(w => w.spend));
  const total = weekly.reduce((s, w) => s + w.spend, 0);
  const weekLabel = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <div className="card mt-6 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base text-ink dark:text-gray-100">Spend · last 8 weeks</h2>
        <span className="tnum text-sm font-semibold text-ink dark:text-gray-100">{money(total)}</span>
      </div>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Week starts Monday. Excludes rejected and cancelled orders.</p>

      <div className="mt-5 flex h-40 items-end gap-1.5 sm:gap-2">
        {weekly.map((w) => (
          <div key={w.weekStart} className="flex flex-1 flex-col items-center gap-1.5" title={`Week of ${weekLabel(w.weekStart)} — ${money(w.spend)}`}>
            <div className="tnum text-[10px] text-gray-500 dark:text-gray-400">
              {w.spend > 0 ? money(w.spend) : '—'}
            </div>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-brand-600 dark:bg-brand-500"
                style={{ height: `${Math.max((w.spend / max) * 100, 1.5)}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">{weekLabel(w.weekStart)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Spend per item as labelled horizontal bars, with the Agmarknet wholesale
// median beside every kilo-priced item the boards know. The verdict is words
// as well as color, so it survives any eyes and any printer.
function TopItems({ items }) {
  if (!items?.length) return null;
  const max = Math.max(1, ...items.map(i => i.spend));

  return (
    <div className="card mt-6 p-5">
      <h2 className="text-base text-ink dark:text-gray-100">What you buy</h2>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">By spend, with the govt mandi rate where one exists.</p>

      <ul className="mt-4 space-y-3">
        {items.map((it) => (
          <li key={it.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium capitalize text-ink dark:text-gray-100">{it.name}</span>
              <span className="tnum shrink-0 text-gray-600 dark:text-gray-300">
                {money(it.spend)} · {it.orders} order{it.orders === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-gray-100 dark:bg-night-700">
              <div
                className="h-2 rounded-full bg-brand-600 dark:bg-brand-500"
                style={{ width: `${Math.max((it.spend / max) * 100, 2)}%` }}
              />
            </div>
            {it.mandiPerKg != null && <MandiVerdict paid={it.paidPerKg} mandi={it.mandiPerKg} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MandiVerdict({ paid, mandi }) {
  // Within 15% of wholesale is a fair retail markup for doorstep delivery.
  const fair = paid <= mandi * 1.15;
  return (
    <p className={'tnum mt-1 text-xs ' + (fair
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-amber-700 dark:text-amber-400')}>
      You pay ₹{paid}/kg · mandi median ₹{mandi}/kg — {fair ? 'close to wholesale' : 'shop around'}
    </p>
  );
}

function TopSuppliers({ suppliers }) {
  if (!suppliers?.length) return null;
  const max = Math.max(1, ...suppliers.map(s => s.spend));

  return (
    <div className="card mt-6 p-5">
      <h2 className="text-base text-ink dark:text-gray-100">Who you buy from</h2>
      <ul className="mt-4 space-y-3">
        {suppliers.map((s) => (
          <li key={s.supplierId}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <Link to={`/suppliers/${s.supplierId}`} className="min-w-0 truncate font-medium text-ink hover:underline dark:text-gray-100">
                {s.name}
                {s.location && <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">{s.location}</span>}
              </Link>
              <span className="tnum shrink-0 text-gray-600 dark:text-gray-300">
                {money(s.spend)} · {s.orders} order{s.orders === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-gray-100 dark:bg-night-700">
              <div
                className="h-2 rounded-full bg-brand-600 dark:bg-brand-500"
                style={{ width: `${Math.max((s.spend / max) * 100, 2)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
