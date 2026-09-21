const express = require('express');
const router = express.Router();
const { z } = require('zod');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { fetchMandiPrices } = require('../services/mandi');
const { fetchForecast } = require('../services/weather');
const { lookupPincode } = require('../services/pincode');
const { routeMatrix } = require('../services/routing');

// =====================================================================
// External data, proxied. The CSP keeps the browser on connect-src 'self',
// and the proxy is where the caching and the API key live anyway. Every
// route here degrades to a 503 the client can shrug off — none of this
// data is allowed to break the marketplace it decorates.
// =====================================================================

// Government mandi (wholesale market) rates for one commodity — the number
// that tells a vendor whether a listed price is fair.
router.get('/mandi',
  requireAuth,
  validate({
    query: z.object({
      commodity: z.string().trim().min(2).max(40).regex(/^[a-z .()-]+$/i),
      state: z.string().trim().min(2).max(40).regex(/^[a-z .&-]+$/i).optional(),
    }),
  }),
  async (req, res) => {
    try {
      res.json(await fetchMandiPrices(req.query.commodity, req.query.state));
    } catch (err) {
      console.error('[mandi] fetch failed:', err.message);
      res.status(503).json({ msg: 'Mandi rates are unavailable right now' });
    }
  },
);

// Two-day forecast for the vendor's spot. Street food demand is weather —
// the strip this feeds says whether tomorrow needs more stock or a tarp.
router.get('/weather',
  requireAuth,
  validate({
    query: z.object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
    }),
  }),
  async (req, res) => {
    try {
      res.json(await fetchForecast(req.query.lat, req.query.lng));
    } catch (err) {
      console.error('[weather] fetch failed:', err.message);
      res.status(503).json({ msg: 'The forecast is unavailable right now' });
    }
  },
);

// Road distance and drive time from the vendor to each nearby supplier —
// "2.4 km away" as the crow flies is not the trip the delivery bike makes.
const POINT = /^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;

function parsePoint(s) {
  const [lat, lng] = s.split(',').map(Number);
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return null;
  return { lat, lng };
}

router.get('/route-matrix',
  requireAuth,
  validate({
    query: z.object({
      from: z.string().regex(POINT),
      // Semicolon separated lat,lng pairs — one per nearby supplier card.
      to: z.string().min(3).max(600),
    }),
  }),
  async (req, res) => {
    const from = parsePoint(req.query.from);
    const dests = req.query.to.split(';').filter(Boolean)
      .map(s => (POINT.test(s) ? parsePoint(s) : null));
    if (!from || dests.length === 0 || dests.length > 24 || dests.includes(null)) {
      return res.status(400).json({ msg: 'Invalid coordinates' });
    }
    try {
      res.json({ routes: await routeMatrix(from, dests) });
    } catch (err) {
      console.error('[route-matrix] fetch failed:', err.message);
      res.status(503).json({ msg: 'Road distances are unavailable right now' });
    }
  },
);

// PIN → locality, for autofilling the address on signup. Public on purpose:
// the form that needs it belongs to a visitor who has no session yet.
router.get('/pincode/:pin',
  validate({ params: z.object({ pin: z.string().regex(/^[1-9][0-9]{5}$/) }) }),
  async (req, res) => {
    try {
      const place = await lookupPincode(req.params.pin);
      if (!place) return res.status(404).json({ msg: 'PIN code not found' });
      res.json(place);
    } catch (err) {
      console.error('[pincode] fetch failed:', err.message);
      res.status(503).json({ msg: 'PIN lookup is unavailable right now' });
    }
  },
);

module.exports = router;
