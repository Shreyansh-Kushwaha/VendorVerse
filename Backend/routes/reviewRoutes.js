const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { z } = require('zod');
const Order = require('../models/Order');
const Review = require('../models/Review');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notifySafely } = require('../services/notifications');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

// =====================================================================
// Rate a delivered order. PUT because sending it twice edits, not duplicates —
// the unique index on orderId is the backstop for two racing first writes.
// =====================================================================
router.put('/orders/:orderId/review',
  requireAuth,
  requireRole('vendor'),
  validate({ params: z.object({ orderId: objectId }), body: reviewSchema }),
  async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.orderId);
      if (!order) return res.status(404).json({ msg: 'Order not found' });
      if (String(order.vendorId) !== String(req.user._id)) {
        return res.status(403).json({ msg: 'That is not your order' });
      }
      if (order.status !== 'Delivered') {
        return res.status(409).json({ msg: 'You can rate an order once it has been delivered' });
      }

      const { rating, comment } = req.body;
      const existing = await Review.findOne({ orderId: order._id });
      const review = await Review.findOneAndUpdate(
        { orderId: order._id },
        {
          $set: { rating, comment: comment || undefined },
          $setOnInsert: { vendorId: order.vendorId, supplierId: order.supplierId },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
      );

      // The supplier hears about a new rating, not about every edit to it.
      if (!existing) {
        await notifySafely(order.supplierId, {
          type: 'review',
          title: `${req.user.name} rated your delivery ${rating}★`,
          body: `${order.itemName} · ${comment ? `“${comment}”` : 'no comment'}`,
          orderId: order._id,
        });
      }

      res.status(existing ? 200 : 201).json({ msg: existing ? 'Review updated' : 'Review added', review });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ msg: 'This order is already reviewed' });
      next(err);
    }
  },
);

// Either party can read the review hanging off an order.
router.get('/orders/:orderId/review',
  requireAuth,
  validate({ params: z.object({ orderId: objectId }) }),
  async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.orderId);
      if (!order) return res.status(404).json({ msg: 'Order not found' });
      const me = String(req.user._id);
      if (me !== String(order.vendorId) && me !== String(order.supplierId)) {
        return res.status(403).json({ msg: 'That is not your order' });
      }
      const review = await Review.findOne({ orderId: order._id });
      res.json({ review });
    } catch (err) { next(err); }
  },
);

// =====================================================================
// A supplier's reviews: average, count, and the newest twenty. Public — the
// same trust signal any visitor can act on.
// =====================================================================
router.get('/suppliers/:supplierId/reviews',
  validate({ params: z.object({ supplierId: objectId }) }),
  async (req, res, next) => {
    try {
      const { supplierId } = req.params;
      const [reviews, [agg]] = await Promise.all([
        Review.find({ supplierId })
          .sort({ createdAt: -1 })
          .limit(20)
          .populate('vendorId', 'name'),
        Review.aggregate([
          { $match: { supplierId: new mongoose.Types.ObjectId(supplierId) } },
          { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]),
      ]);
      res.json({
        average: agg ? Math.round(agg.average * 10) / 10 : null,
        count: agg?.count || 0,
        reviews: reviews.map(r => ({
          _id: r._id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          vendorName: r.vendorId?.name || 'Deleted account',
        })),
      });
    } catch (err) { next(err); }
  },
);

module.exports = router;
