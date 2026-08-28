import { useEffect, useState } from 'react';
import api from '../api.js';
import Modal from './Modal.jsx';
import { money, perUnit } from '../format.js';

const DAY = 24 * 60 * 60 * 1000;

// A listed price holds steady between changes, so the honest shape is a step
// line, not a slope — the price jumps, it does not drift.
function stepPath(pts, x, y) {
  let d = `M ${x(pts[0].t)} ${y(pts[0].price)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` H ${x(pts[i].t)} V ${y(pts[i].price)}`;
  }
  return d;
}

export default function PriceTrendModal({ item, onClose }) {
  const [points, setPoints] = useState(null);

  useEffect(() => {
    if (!item) return;
    setPoints(null);
    let on = true;
    api.get(`/items/${item.itemId}/prices`)
      .then(({ data }) => { if (on) setPoints(data.points); })
      .catch(() => { if (on) setPoints([]); });
    return () => { on = false; };
  }, [item]);

  if (!item) return null;

  const pts = (points || []).map((p) => ({ t: new Date(p.at).getTime(), price: p.price }));
  // Extend the line to "now" so the flat stretch since the last change shows.
  if (pts.length > 0) pts.push({ t: Date.now(), price: item.price });

  const prices = pts.map(p => p.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const changes = Math.max(0, (points?.length || 1) - 1);
  const since = pts.length ? new Date(pts[0].t) : null;

  // Chart geometry. Y is padded so a flat line does not hug an edge.
  const W = 320, H = 110, PX = 6, PY = 12;
  const t0 = pts.length ? pts[0].t : 0;
  const t1 = pts.length ? Math.max(pts[pts.length - 1].t, t0 + DAY) : 1;
  const span = hi - lo || hi * 0.1 || 1;
  const x = (t) => PX + ((t - t0) / (t1 - t0)) * (W - 2 * PX);
  const y = (p) => H - PY - ((p - (lo - span * 0.15)) / (span * 1.3)) * (H - 2 * PY);

  return (
    <Modal open onClose={onClose} title={`${item.itemName} · price history`} size="sm">
      {points === null ? (
        <div className="skel h-28 rounded-xl" />
      ) : pts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No price history recorded for this listing yet.
        </p>
      ) : (
        <div>
          <div className="flex items-baseline justify-between">
            <span className="tnum text-2xl font-medium tracking-tight text-ink dark:text-gray-100">
              {perUnit(item.price, item.unit)}
            </span>
            {changes > 0 && hi !== lo && (
              <span className="tnum text-xs text-gray-500 dark:text-gray-400">
                low {money(lo)} · high {money(hi)}
              </span>
            )}
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full text-brand-600 dark:text-brand-400" role="img"
            aria-label={`Price of ${item.itemName} over time, from ${money(pts[0].price)} to ${money(item.price)} per ${item.unit}`}>
            <path d={stepPath(pts, x, y)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            {/* A dot at every change the supplier actually made. */}
            {pts.slice(0, -1).map((p, i) => (
              <circle key={i} cx={x(p.t)} cy={y(p.price)} r="3.5" fill="currentColor">
                <title>{`${money(p.price)}/${item.unit} · ${new Date(p.t).toLocaleDateString()}`}</title>
              </circle>
            ))}
            <circle cx={x(pts[pts.length - 1].t)} cy={y(pts[pts.length - 1].price)} r="3.5"
              fill="currentColor" className="animate-pulse" />
          </svg>

          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {changes === 0
              ? <>Listed at {perUnit(item.price, item.unit)} since {since.toLocaleDateString()} — no changes yet.</>
              : <>{changes} price change{changes === 1 ? '' : 's'} since {since.toLocaleDateString()}.</>}
          </p>
        </div>
      )}
    </Modal>
  );
}
