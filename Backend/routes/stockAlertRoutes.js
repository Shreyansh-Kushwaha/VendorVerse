const express = require('express');
const router = express.Router();
const { z } = require('zod');
const Supplier = require('../models/Supplier');
const StockAlert = require('../models/StockAlert');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// The dashboard needs the ids to render bells as on or off.
router.get('/stock-alerts',
  requireAuth,
  requireRole('vendor'),
  async (req, res, next) => {
    try {
      const alerts = await StockAlert.find({ vendorId: req.user._id })
        .select('itemId supplierId itemName');
      res.json({ alerts });
    } catch (err) { next(err); }
  },
);

router.post('/stock-alerts',
  requireAuth,
  requireRole('vendor'),
  validate({ body: z.object({ supplierId: objectId, itemId: objectId }) }),
  async (req, res, next) => {
    try {
      const { supplierId, itemId } = req.body;
      const doc = await Supplier.findOne({ supplierId, 'inventory._id': itemId });
      const item = doc?.inventory?.id(itemId);
      if (!item) return res.status(404).json({ msg: 'That item is no longer listed' });

      // Upsert, so tapping the bell twice in two tabs is still one subscription.
      const alert = await StockAlert.findOneAndUpdate(
        { vendorId: req.user._id, itemId },
        { $setOnInsert: { supplierId, itemName: item.itemName } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      res.status(201).json({ msg: `You will hear when ${item.itemName} is back`, alert });
    } catch (err) {
      if (err.code === 11000) return res.status(201).json({ msg: 'Already watching this item' });
      next(err);
    }
  },
);

router.delete('/stock-alerts/:itemId',
  requireAuth,
  requireRole('vendor'),
  validate({ params: z.object({ itemId: objectId }) }),
  async (req, res, next) => {
    try {
      await StockAlert.deleteOne({ vendorId: req.user._id, itemId: req.params.itemId });
      res.json({ msg: 'Alert removed' });
    } catch (err) { next(err); }
  },
);

module.exports = router;
