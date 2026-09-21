const TTLCache = require('../lib/ttlCache');

// Open-Meteo needs no API key. Two days is enough — today explains the street,
// tomorrow decides how much stock to buy tonight.
const FORECAST = 'https://api.open-meteo.com/v1/forecast';

// Coordinates round to ~1 km buckets, so every vendor in the same area shares
// one forecast for half an hour.
const cache = new TTLCache(30 * 60 * 1000, 500);

async function fetchForecast(lat, lng) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const url = new URL(FORECAST);
  url.searchParams.set('latitude', lat.toFixed(2));
  url.searchParams.set('longitude', lng.toFixed(2));
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
  url.searchParams.set('forecast_days', '2');
  url.searchParams.set('timezone', 'auto');

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`open-meteo responded ${res.status}`);
  const data = await res.json();

  const d = data.daily || {};
  const days = (d.time || []).map((date, i) => ({
    date,
    code: d.weather_code?.[i] ?? null,
    tMax: d.temperature_2m_max?.[i] != null ? Math.round(d.temperature_2m_max[i]) : null,
    tMin: d.temperature_2m_min?.[i] != null ? Math.round(d.temperature_2m_min[i]) : null,
    rainChance: d.precipitation_probability_max?.[i] ?? null,
  }));

  const result = { days };
  cache.set(key, result);
  return result;
}

module.exports = { fetchForecast };
