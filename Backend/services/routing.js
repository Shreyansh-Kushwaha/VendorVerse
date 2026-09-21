const TTLCache = require('../lib/ttlCache');

// OSRM's public demo server. The table service answers "how far is the vendor
// from each of these suppliers, by road" in a single upstream call.
const OSRM = 'https://router.project-osrm.org/table/v1/driving';

// Rounding to ~100 m buckets means a vendor tapping "Near me" twice from the
// same corner reuses the answer for ten minutes.
const cache = new TTLCache(10 * 60 * 1000, 500);

// from: {lat, lng}; dests: [{lat, lng}]. Returns one {km, minutes} per
// destination, in order, with null where OSRM had no road answer.
async function routeMatrix(from, dests) {
  const points = [from, ...dests];
  const key = points.map(p => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join(';');
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `${OSRM}/${coords}?sources=0&annotations=duration,distance`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OSRM responded ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error(`OSRM said ${data.code}`);

  const routes = dests.map((_, i) => {
    const duration = data.durations?.[0]?.[i + 1];
    const distance = data.distances?.[0]?.[i + 1];
    if (duration == null || distance == null) return null;
    return {
      km: Math.round(distance / 100) / 10,
      minutes: Math.max(1, Math.round(duration / 60)),
    };
  });

  cache.set(key, routes);
  return routes;
}

module.exports = { routeMatrix };
