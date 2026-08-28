const express = require('express');
const router = express.Router();
const { z } = require('zod');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { fetchMandiPrices } = require('../services/mandi');
const { fetchForecast } = require('../services/weather');

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

module.exports = router;
