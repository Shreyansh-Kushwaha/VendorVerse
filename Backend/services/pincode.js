const TTLCache = require('../lib/ttlCache');

// India Post's PIN directory via postalpincode.in — free, no key. A PIN's
// locality changes about never, so a day of caching is conservative.
const cache = new TTLCache(24 * 60 * 60 * 1000, 2000);

// Resolves a 6-digit PIN to { area, district, state }, or null when the
// directory does not know it. Unknown PINs are cached too — a typo repeated
// across a form should not repeat the upstream call.
async function lookupPincode(pin) {
  const hit = cache.get(pin);
  if (hit !== undefined) return hit;

  const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`postalpincode.in responded ${res.status}`);
  const [data] = await res.json();

  let result = null;
  if (data?.Status === 'Success' && data.PostOffice?.length) {
    const po = data.PostOffice[0];
    result = { pin, area: po.Name, district: po.District, state: po.State };
  }
  cache.set(pin, result);
  return result;
}

module.exports = { lookupPincode };
