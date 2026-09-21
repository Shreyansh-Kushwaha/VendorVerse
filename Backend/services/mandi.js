const TTLCache = require('../lib/ttlCache');

// Agmarknet's "current daily price of various commodities from various
// markets" dataset on data.gov.in. Prices arrive in ₹ per quintal (100 kg).
const RESOURCE = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';

// data.gov.in's published sample key, fine for light use. Set DATA_GOV_API_KEY
// to a personal key (free signup) for a real deployment.
const SAMPLE_KEY = '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';

// Mandi boards publish once a day, so six hours keeps us to a handful of
// upstream calls per commodity per day.
const cache = new TTLCache(6 * 60 * 60 * 1000, 200);

// "2400" ₹/quintal → 24 ₹/kg. Boards report a 0 when a market had no
// arrivals; that is an absent price, not a free vegetable.
function toPerKg(perQuintal) {
  const n = Number(perQuintal);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n) / 100;
}

async function fetchMandiPrices(commodity, state) {
  const key = `${commodity.toLowerCase()}|${(state || '').toLowerCase()}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const url = new URL(RESOURCE);
  url.searchParams.set('api-key', process.env.DATA_GOV_API_KEY || SAMPLE_KEY);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '80');
  url.searchParams.set('filters[commodity]', commodity);
  if (state) url.searchParams.set('filters[state]', state);

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`data.gov.in responded ${res.status}`);
  const data = await res.json();

  // A rate-limited key answers 200 with {"error": ...} and no records. That
  // must throw, not be cached for six hours as "no arrivals today".
  if (!Array.isArray(data.records)) {
    throw new Error(data.error || 'data.gov.in sent no records array');
  }

  const records = data.records
    .map((r) => ({
      market: r.market,
      district: r.district,
      state: r.state,
      variety: r.variety,
      date: r.arrival_date,
      minPerKg: toPerKg(r.min_price),
      maxPerKg: toPerKg(r.max_price),
      modalPerKg: toPerKg(r.modal_price),
    }))
    .filter((r) => r.modalPerKg !== null)
    .sort((a, b) => a.modalPerKg - b.modalPerKg);

  // The modal price is what most trades actually closed at. The median across
  // mandis is the headline, so one outlier market cannot skew it.
  let medianPerKg = null;
  if (records.length) {
    const mid = records.length >> 1;
    medianPerKg = records.length % 2
      ? records[mid].modalPerKg
      : Math.round(((records[mid - 1].modalPerKg + records[mid].modalPerKg) / 2) * 100) / 100;
  }

  const result = {
    commodity,
    state: state || null,
    count: records.length,
    medianPerKg,
    records: records.slice(0, 12),
  };
  cache.set(key, result);
  return result;
}

module.exports = { fetchMandiPrices };
