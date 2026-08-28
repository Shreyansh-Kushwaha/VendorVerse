const express = require('express');
const router = express.Router();
const { z } = require('zod');
const User = require('../models/user');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const Review = require('../models/Review');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { objectId } = require('../lib/ids');

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Every route in this file is admin-only. One gate at the top, so a route
// added later cannot forget it.
router.use('/admin', requireAuth, requireRole('admin'));

// =====================================================================
// Overview: the whole marketplace in one read.
// =====================================================================
router.get('/admin/overview', async (req, res, next) => {
  try {
    const GMV = {
      $cond: [
        { $in: ['$status', ['Rejected', 'Cancelled']] },
        0,
        { $multiply: [{ $ifNull: ['$quantity', 0] }, { $ifNull: ['$price', 0] }] },
      ],
    };
    const [users, stockedSuppliers, orderAgg, reviews, recentUsers] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: '$userType',
            n: { $sum: 1 },
            suspended: { $sum: { $cond: ['$suspended', 1, 0] } },
          },
        },
      ]),
      Supplier.countDocuments({ 'inventory.0': { $exists: true } }),
      Order.aggregate([
        {
          $facet: {
            byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
            totals: [{ $group: { _id: null, orders: { $sum: 1 }, gmv: { $sum: GMV } } }],
          },
        },
      ]),
      Review.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(5).select('name userType location createdAt').lean(),
    ]);

    const roles = Object.fromEntries(users.map(u => [u._id, { n: u.n, suspended: u.suspended }]));
    res.json({
      users: {
        vendors: roles.vendor?.n || 0,
        suppliers: roles.supplier?.n || 0,
        admins: roles.admin?.n || 0,
        suspended: users.reduce((s, u) => s + u.suspended, 0),
      },
      stockedSuppliers,
      orders: orderAgg[0].totals[0]?.orders || 0,
      gmv: orderAgg[0].totals[0]?.gmv || 0,
      ordersByStatus: Object.fromEntries(orderAgg[0].byStatus.map(s => [s._id, s.n])),
      reviews,
      recentUsers,
    });
  } catch (err) { next(err); }
});

// =====================================================================
// Users: searchable list + suspend/restore.
// =====================================================================
router.get('/admin/users',
  validate({
    query: z.object({
      q: z.string().trim().max(100).optional(),
      role: z.enum(['all', 'vendor', 'supplier', 'admin']).default('all'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
  }),
  async (req, res, next) => {
    try {
      const { q, role, page, limit } = req.query;
      const filter = {};
      if (role !== 'all') filter.userType = role;
      if (q) {
        const rx = new RegExp(escapeRegex(q), 'i');
        filter.$or = [{ name: rx }, { email: rx }, { location: rx }, { businessName: rx }];
      }
      const [users, total] = await Promise.all([
        User.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select('name email userType location businessName suspended createdAt')
          .lean(),
        User.countDocuments(filter),
      ]);
      res.json({ users, total, page, pages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
  },
);

router.patch('/admin/users/:id/suspend',
  validate({
    params: z.object({ id: objectId }),
    body: z.object({ suspended: z.boolean() }),
  }),
  async (req, res, next) => {
    try {
      const target = await User.findById(req.params.id).select('-password');
      if (!target) return res.status(404).json({ msg: 'User not found' });
      // Admins cannot suspend each other — revoking an admin is a database
      // decision, not a button. This also makes locking yourself out impossible.
      if (target.userType === 'admin') {
        return res.status(403).json({ msg: 'Admins cannot be suspended from here' });
      }
      target.suspended = req.body.suspended;
      await target.save();
      res.json({
        msg: req.body.suspended ? `${target.name} is suspended` : `${target.name} is back`,
        user: { _id: target._id, suspended: target.suspended },
      });
    } catch (err) { next(err); }
  },
);

// =====================================================================
// Moderation: reviews and listings.
// =====================================================================
router.get('/admin/reviews',
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
  }),
  async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const [reviews, total] = await Promise.all([
        Review.find()
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('vendorId', 'name')
          .populate('supplierId', 'name')
          .lean(),
        Review.countDocuments(),
      ]);
      res.json({ reviews, total, page, pages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
  },
);

router.delete('/admin/reviews/:id',
  validate({ params: z.object({ id: objectId }) }),
  async (req, res, next) => {
    try {
      const gone = await Review.findByIdAndDelete(req.params.id);
      if (!gone) return res.status(404).json({ msg: 'Review not found' });
      // The rating average recomputes from what remains on the next read —
      // there is no cached number to fix up.
      res.json({ msg: 'Review removed' });
    } catch (err) { next(err); }
  },
);

router.delete('/admin/listings/:supplierId/:itemId',
  validate({ params: z.object({ supplierId: objectId, itemId: objectId }) }),
  async (req, res, next) => {
    try {
      const { supplierId, itemId } = req.params;
      const updated = await Supplier.findOneAndUpdate(
        { supplierId, 'inventory._id': itemId },
        { $pull: { inventory: { _id: itemId } } },
        { new: true },
      );
      if (!updated) return res.status(404).json({ msg: 'Listing not found' });
      res.json({ msg: 'Listing removed' });
    } catch (err) { next(err); }
  },
);

module.exports = router;
