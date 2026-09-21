// Delivery windows a vendor can ask for at checkout. The checkout picker, the
// supplier's order card and the validation schema all read from here so they
// cannot drift apart. Empty means "anytime".
const SLOTS = [
  'Early morning (5–8 AM)',
  'Morning (8–11 AM)',
  'Afternoon (11 AM–3 PM)',
  'Evening (3–7 PM)',
];

module.exports = { SLOTS };
