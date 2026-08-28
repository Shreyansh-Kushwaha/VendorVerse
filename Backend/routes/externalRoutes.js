const express = require('express');
const router = express.Router();
const { z } = require('zod');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { fetchMandiPrices } = require('../services/mandi');

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

module.exports = router;
