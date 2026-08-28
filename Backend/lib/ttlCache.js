// A tiny in-memory TTL cache for the external services this app proxies.
// Everything upstream is stable for minutes to hours — mandi boards publish
// daily, forecasts shift half-hourly, the PIN directory effectively never —
// so a bounded map with expiry is enough. No Redis for a cache that fits
// comfortably in one process.
class TTLCache {
  constructor(ttlMs, max = 500) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.map = new Map();
  }

  // Returns undefined on a miss, so a cached null ("we asked, nothing there")
  // is distinguishable from "never asked".
  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value) {
    // Oldest-inserted eviction keeps the map bounded under key churn.
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  clear() {
    this.map.clear();
  }
}

module.exports = TTLCache;
