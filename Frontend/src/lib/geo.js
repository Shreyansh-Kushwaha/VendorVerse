// Browser position as a promise. Resolves null instead of rejecting — a vendor
// who declines simply doesn't get distances, nothing breaks.
export function getPosition(timeout = 6000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout, maximumAge: 10 * 60 * 1000 },
    );
  });
}

// Straight-line distance in km between {lat,lng} and a GeoJSON [lng,lat] pair.
export function distanceKm(pos, coordinates) {
  if (!pos || !coordinates || coordinates.length !== 2) return null;
  const [lng, lat] = coordinates;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat - pos.lat);
  const dLng = rad(lng - pos.lng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(pos.lat)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// "850 m" under a kilometre, "2.4 km" under ten, whole km beyond.
export function formatKm(km) {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
