import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Supplier names are user data and the popup is HTML.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The nearby suppliers on an OpenStreetMap canvas. Loaded lazily — Leaflet
// only ships to vendors who tapped "Near me". Circle markers instead of the
// default icons, so no image assets to wrangle through the bundler.
export default function SupplierMap({ pos, suppliers }) {
  const el = useRef(null);

  useEffect(() => {
    const map = L.map(el.current, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const bounds = [[pos.lat, pos.lng]];
    L.circleMarker([pos.lat, pos.lng], {
      radius: 8, weight: 2, color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.9,
    }).addTo(map).bindPopup('You are here');

    for (const s of suppliers) {
      const c = s.geo?.coordinates;
      if (!c) continue;
      const [lng, lat] = c;
      bounds.push([lat, lng]);
      const trip = s.route ? `${s.route.minutes} min · ${s.route.km} km by road` : `${s.distanceKm} km away`;
      L.circleMarker([lat, lng], {
        radius: 7, weight: 2, color: '#9A3412', fillColor: '#C2410C', fillOpacity: 0.9,
      }).addTo(map).bindPopup(
        `<a href="/suppliers/${esc(s.supplierId)}"><b>${esc(s.name)}</b></a><br>` +
        `${s.items} item${s.items === 1 ? '' : 's'} · ${trip}`,
      );
    }

    map.fitBounds(L.latLngBounds(bounds).pad(0.25));
    return () => map.remove();
  }, [pos, suppliers]);

  return (
    <div
      ref={el}
      className="z-0 mb-3 h-64 w-full overflow-hidden rounded-xl border border-gray-200 dark:border-night-600"
      aria-label="Map of suppliers near you"
    />
  );
}
