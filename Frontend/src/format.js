// Units a supplier can list in. Mirrors Backend/lib/units.js.
export const UNITS = ['kg', 'g', 'L', 'ml', 'piece', 'dozen', 'crate', 'sack'];
export const DEFAULT_UNIT = 'kg';

// Item categories. Mirrors Backend/lib/categories.js.
export const CATEGORIES = ['vegetables', 'fruits', 'spices', 'grains', 'dairy', 'others'];

// Delivery windows offered at checkout. Mirrors Backend/lib/slots.js.
export const SLOTS = [
  'Early morning (5–8 AM)',
  'Morning (8–11 AM)',
  'Afternoon (11 AM–3 PM)',
  'Evening (3–7 PM)',
];

// Indian digit grouping — 1,20,000 rather than 120,000.
export function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

// "₹40/kg" — the whole point of carrying a unit around.
export function perUnit(price, unit) {
  return `${money(price)}/${unit || DEFAULT_UNIT}`;
}

// "10 kg"
export function amount(qty, unit) {
  return `${qty ?? 0} ${unit || DEFAULT_UNIT}`;
}
