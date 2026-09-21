import { useEffect, useState } from 'react';
import api from '../api.js';

// The staples a street stall actually restocks. Names must match Agmarknet's
// commodity spellings, which is why "Green Chilli" has two Ls.
const COMMODITIES = ['Onion', 'Potato', 'Tomato', 'Green Chilli', 'Garlic', 'Ginger'];

// Today's government wholesale rates for one commodity, so a vendor can judge
// whether a listed price is fair before adding it to the cart.
export default function MandiRates() {
  const [commodity, setCommodity] = useState('Onion');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let on = true;
    setStatus('loading');
    api.get('/mandi', { params: { commodity } })
      .then(({ data }) => { if (on) { setData(data); setStatus('ok'); } })
      .catch(() => { if (on) setStatus('error'); });
    return () => { on = false; };
  }, [commodity]);

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Govt mandi rates · wholesale, per kg
      </h2>
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          {COMMODITIES.map((c) => {
            const active = commodity === c;
            return (
              <button
                key={c}
                onClick={() => setCommodity(c)}
                aria-pressed={active}
                className={'chip ' + (active
                  ? 'bg-brand-600 text-white'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-night-600 dark:text-gray-300 dark:hover:bg-night-700')}
              >
                {c}
              </button>
            );
          })}
        </div>

        <div className="mt-3 min-h-[3.5rem]">
          {status === 'loading' && (
            <div className="space-y-2">
              <div className="skel h-4 w-1/3" />
              <div className="skel h-4 w-2/3" />
            </div>
          )}
          {status === 'error' && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mandi rates are unavailable right now — try again in a bit.
            </p>
          )}
          {status === 'ok' && data.count === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No mandi reported {commodity} arrivals today.
            </p>
          )}
          {status === 'ok' && data.count > 0 && (
            <>
              <p className="text-sm text-ink dark:text-gray-100">
                <span className="tnum text-lg font-semibold">₹{data.medianPerKg}/kg</span>
                <span className="text-gray-500 dark:text-gray-400"> median across {data.count} mandi{data.count === 1 ? '' : 's'}</span>
              </p>
              <ul className="mt-1.5 space-y-0.5 text-xs text-gray-600 dark:text-gray-300">
                {data.records.slice(0, 3).map((r, i) => (
                  <li key={i} className="tnum truncate">
                    <span className="font-medium">₹{r.modalPerKg}/kg</span>
                    {' — '}{r.market}{r.district && r.district !== r.market ? `, ${r.district}` : ''}{r.state ? ` (${r.state})` : ''}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                Source: Agmarknet via data.gov.in · {data.records[0]?.date}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
