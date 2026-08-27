// Units a supplier can list an item in. Price is always per one of these, so
// "₹40" becomes "₹40/kg" and a vendor can actually compare two listings.
const UNITS = ['kg', 'g', 'L', 'ml', 'piece', 'dozen', 'crate', 'sack'];
const DEFAULT_UNIT = 'kg';

module.exports = { UNITS, DEFAULT_UNIT };
