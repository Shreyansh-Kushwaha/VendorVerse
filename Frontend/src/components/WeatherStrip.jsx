import { useEffect, useState } from 'react';
import api from '../api.js';

// WMO weather codes, collapsed to what matters at a stall: is it clear, wet,
// or dangerous.
function describe(code) {
  if (code === 0) return { label: 'Clear', icon: '☀️' };
  if (code <= 2) return { label: 'Mostly clear', icon: '🌤️' };
  if (code === 3) return { label: 'Overcast', icon: '☁️' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: '🌫️' };
  if (code <= 57) return { label: 'Drizzle', icon: '🌦️' };
  if (code <= 67) return { label: 'Rain', icon: '🌧️' };
  if (code <= 77) return { label: 'Snow', icon: '🌨️' };
  if (code <= 82) return { label: 'Showers', icon: '🌧️' };
  if (code >= 95) return { label: 'Thunderstorm', icon: '⛈️' };
  return { label: '—', icon: '🌡️' };
}

// Rain tomorrow is a stocking decision tonight; that is the only case loud
// enough to earn an advisory line.
function advisory(tomorrow) {
  if (!tomorrow) return null;
  if (tomorrow.code >= 95) return 'Thunderstorms expected tomorrow — cover your stock and expect delivery delays.';
  if (tomorrow.rainChance >= 60) return 'Rain likely tomorrow — plan covered storage; deliveries may run late.';
  return null;
}

// Two-day outlook for the vendor's spot. Rendered only once the vendor has
// tapped "Near me", so it reuses the position they already chose to share.
export default function WeatherStrip({ pos }) {
  const [days, setDays] = useState(null);

  useEffect(() => {
    if (!pos) return;
    let on = true;
    api.get('/weather', { params: { lat: pos.lat, lng: pos.lng } })
      .then(({ data }) => { if (on) setDays(data.days); })
      .catch(() => {}); // the forecast is decoration — no error state needed
    return () => { on = false; };
  }, [pos]);

  if (!days?.length) return null;
  const [today, tomorrow] = days;
  const note = advisory(tomorrow);

  return (
    <div className="card mb-3 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
        {[['Today', today], ['Tomorrow', tomorrow]].map(([name, d]) => d && (
          <span key={name} className="tnum">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{name}</span>
            {' '}{describe(d.code).icon} {describe(d.code).label} · {d.tMax}°/{d.tMin}°
            {d.rainChance != null && d.rainChance >= 30 && ` · ${d.rainChance}% rain`}
          </span>
        ))}
      </div>
      {note && (
        <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">{note}</p>
      )}
    </div>
  );
}
