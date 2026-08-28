const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { z } = require('zod');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const Review = require('../models/Review');
const User = require('../models/user');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { releaseOrderStock } = require('../services/orders');
const { fireRestockAlerts } = require('../services/stockAlerts');
const { UNITS, DEFAULT_UNIT } = require('../lib/units');
const { CATEGORIES } = require('../lib/categories');

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const { notifySafely } = require('../services/notifications');

// Packed is an internal step. The vendor does not need a mail for it.
const EMAIL_ON_STATUS = new Set(['Accepted', 'Rejected', 'OutForDelivery', 'Delivered']);

const STATUS_WORDING = {
  Accepted:       'has been accepted',
  Packed:         'has been packed',
  OutForDelivery: 'is out for delivery',
  Delivered:      'has been delivered',
  Rejected:       'was rejected by the supplier',
  Cancelled:      'was cancelled',
};

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// The :supplierId in the path must be the signed-in supplier.
function ownsSupplier(req, res, next) {
  if (String(req.user._id) !== req.params.supplierId) {
    return res.status(403).json({ msg: 'That is not your inventory' });
  }
  next();
}

// One Supplier doc per supplier, enforced by a unique index. The old find then
// insert could interleave and produce two docs for the same supplier.
async function getOrCreateSupplier(supplierId, name, location) {
  try {
    return await Supplier.findOneAndUpdate(
      { supplierId },
      { $set: { name, location: location || '—' }, $setOnInsert: { inventory: [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (err) {
    if (err.code === 11000) return Supplier.findOne({ supplierId }); // lost the race
    throw err;
  }
}

// =====================================================================
// Inventory: add an item (upsert supplier doc + push to inventory array)
// =====================================================================
const addInventorySchema = z.object({
  location: z.string().min(1),
  inventory: z.object({
    itemName: z.string().min(1),
    quantity: z.number().int().nonnegative(),
    price: z.number().nonnegative(),
    unit: z.enum(UNITS).default(DEFAULT_UNIT),
    category: z.enum(CATEGORIES),
    imageUrl: z.string().url().optional(),
  }),
});

router.post('/suppliers',
  requireAuth,
  requireRole('supplier'),
  validate({ body: addInventorySchema }),
  async (req, res, next) => {
  try {
    const { location, inventory } = req.body;
    const supplierId = req.user._id;
    const doc = await getOrCreateSupplier(supplierId, req.user.name, location);
    doc.inventory.push(inventory);
    await doc.save();
    const added = doc.inventory[doc.inventory.length - 1];
    res.status(201).json({ msg: 'Item added', item: added, supplier: doc });
  } catch (err) { next(err); }
});

// =====================================================================
// Suppliers: list (public) + per-supplier profile + per-supplier inventory
// =====================================================================
// =====================================================================
// Landing page: counts plus a cheapest-offer price strip. Public — the same
// numbers a visitor could read off any public supplier profile.
// =====================================================================
router.get('/landing', async (req, res, next) => {
  try {
    const [agg] = await Supplier.aggregate([
      { $unwind: '$inventory' },
      { $match: { 'inventory.price': { $gt: 0 } } },
      {
        $facet: {
          counts: [
            {
              $group: {
                _id: null,
                items: { $sum: 1 },
                suppliers: { $addToSet: '$supplierId' },
                cities: { $addToSet: { $toLower: { $trim: { input: '$location' } } } },
              },
            },
          ],
          ticker: [
            { $sort: { 'inventory.price': 1 } },
            {
              $group: {
                _id: { $toLower: '$inventory.itemName' },
                name: { $first: '$inventory.itemName' },
                price: { $first: '$inventory.price' },
                unit: { $first: '$inventory.unit' },
              },
            },
            { $sort: { _id: 1 } },
            { $limit: 14 },
            { $project: { _id: 0 } },
          ],
          categories: [
            { $group: { _id: '$inventory.category', items: { $sum: 1 } } },
            { $project: { _id: 0, category: '$_id', items: 1 } },
          ],
        },
      },
    ]);
    const c = agg.counts[0] || {};
    res.json({
      items: c.items || 0,
      suppliers: (c.suppliers || []).length,
      cities: (c.cities || []).length,
      ticker: agg.ticker,
      categories: agg.categories,
    });
  } catch (err) { next(err); }
});

// =====================================================================
// Catalog: one flat, filtered, paginated page of items.
// Replaces the old GET /suppliers, which sent every supplier's entire
// inventory and left the browser to flatten and filter it.
// =====================================================================
router.get('/items',
  requireAuth,
  validate({
    query: z.object({
      q: z.string().trim().max(100).optional(),
      category: z.enum(['all', ...CATEGORIES]).default('all'),
      // Comma separated supplier ids, used by the favourites filter.
      suppliers: z.string().max(2000).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(60).default(24),
    }),
  }),
  async (req, res, next) => {
    try {
      const { q, category, suppliers, page, limit } = req.query;

      const preMatch = {};
      if (suppliers !== undefined) {
        const ids = suppliers.split(',')
          .map(id => id.trim())
          .filter(id => /^[a-f\d]{24}$/i.test(id))
          .map(id => new mongoose.Types.ObjectId(id));
        // An explicit but empty filter means "none", not "everything".
        if (ids.length === 0) {
          return res.json({ items: [], total: 0, page, limit, pages: 0 });
        }
        preMatch.supplierId = { $in: ids };
      }

      const postMatch = {};
      if (category !== 'all') postMatch['inventory.category'] = category;
      if (q) {
        const rx = new RegExp(escapeRegex(q), 'i');
        postMatch.$or = [{ 'inventory.itemName': rx }, { name: rx }];
      }

      const [result] = await Supplier.aggregate([
        ...(preMatch.supplierId ? [{ $match: preMatch }] : []),
        { $unwind: '$inventory' },
        ...(Object.keys(postMatch).length ? [{ $match: postMatch }] : []),
        // Name first so the same item from different suppliers lands adjacent and
        // the client can group it; price second so the cheapest offer leads the
        // group, which is the whole point of quoting everything per unit.
        { $sort: { 'inventory.itemName': 1, 'inventory.price': 1, 'inventory._id': 1 } },
        {
          $facet: {
            rows: [
              { $skip: (page - 1) * limit },
              { $limit: limit },
              // Only the page being sent pays for the ratings lookup.
              { $lookup: { from: 'reviews', localField: 'supplierId', foreignField: 'supplierId', as: 'reviews' } },
              {
                $project: {
                  _id: 0,
                  itemId: '$inventory._id',
                  itemName: '$inventory.itemName',
                  price: '$inventory.price',
                  unit: '$inventory.unit',
                  quantity: '$inventory.quantity',
                  category: '$inventory.category',
                  imageUrl: '$inventory.imageUrl',
                  supplierId: '$supplierId',
                  supplierName: '$name',
                  location: '$location',
                  rating: { $round: [{ $avg: '$reviews.rating' }, 1] },
                  ratingCount: { $size: '$reviews' },
                },
              },
            ],
            total: [{ $count: 'n' }],
          },
        },
      ]);

      const total = result.total[0]?.n || 0;
      res.json({ items: result.rows, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (err) { next(err); }
  },
);

router.get('/suppliers/:supplierId',
  validate({ params: z.object({ supplierId: objectId }) }),
  async (req, res, next) => {
    try {
      const { supplierId } = req.params;
      const [user, doc, [ratingAgg]] = await Promise.all([
        User.findById(supplierId).select('-password'),
        Supplier.findOne({ supplierId }),
        Review.aggregate([
          { $match: { supplierId: new mongoose.Types.ObjectId(supplierId) } },
          { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]),
      ]);
      if (!user) return res.status(404).json({ msg: 'Supplier not found' });
      const inventory = doc?.inventory || [];
      const location = doc?.location || user.location;
      res.json({
        _id: user._id,
        name: user.name,
        businessName: user.businessName,
        location,
        email: user.email,
        memberSince: user.createdAt,
        rating: ratingAgg ? Math.round(ratingAgg.average * 10) / 10 : null,
        ratingCount: ratingAgg?.count || 0,
        inventory,
      });
    } catch (err) { next(err); }
  },
);

router.get('/suppliers/:supplierId/inventory',
  validate({ params: z.object({ supplierId: objectId }) }),
  async (req, res, next) => {
    try {
      const { supplierId } = req.params;
      const doc = await Supplier.findOne({ supplierId });
      res.json(doc?.inventory || []);
    } catch (err) { next(err); }
  },
);

// =====================================================================
// Inventory: update / delete a single item by its _id
// =====================================================================
const editInventorySchema = z.object({
  itemName: z.string().min(1).optional(),
  quantity: z.number().int().nonnegative().optional(),
  price: z.number().nonnegative().optional(),
  unit: z.enum(UNITS).optional(),
  category: z.enum(CATEGORIES).optional(),
  imageUrl: z.string().url().optional(),
});

router.patch('/suppliers/:supplierId/inventory/:itemId',
  requireAuth,
  requireRole('supplier'),
  ownsSupplier,
  validate({
    params: z.object({ supplierId: objectId, itemId: objectId }),
    body: editInventorySchema,
  }),
  async (req, res, next) => {
    try {
      const { supplierId, itemId } = req.params;
      const setObj = {};
      for (const [k, v] of Object.entries(req.body)) {
        setObj[`inventory.$.${k}`] = v;
      }
      // The pre-update doc tells us whether this write is a restock.
      const before = await Supplier.findOne({ supplierId, 'inventory._id': itemId });
      const prevQty = before?.inventory?.id(itemId)?.quantity ?? 0;
      const updated = await Supplier.findOneAndUpdate(
        { supplierId, 'inventory._id': itemId },
        { $set: setObj },
        { new: true },
      );
      if (!updated) return res.status(404).json({ msg: 'Item not found' });
      const item = updated.inventory.id(itemId);

      // Empty before, stocked now — tell everyone who asked to be told.
      if (prevQty <= 0 && item.quantity > 0) {
        await fireRestockAlerts(req.user.name, item);
      }

      res.json({ msg: 'Updated', item });
    } catch (err) { next(err); }
  },
);

router.delete('/suppliers/:supplierId/inventory/:itemId',
  requireAuth,
  requireRole('supplier'),
  ownsSupplier,
  validate({ params: z.object({ supplierId: objectId, itemId: objectId }) }),
  async (req, res, next) => {
    try {
      const { supplierId, itemId } = req.params;
      const updated = await Supplier.findOneAndUpdate(
        { supplierId, 'inventory._id': itemId },
        { $pull: { inventory: { _id: itemId } } },
        { new: true },
      );
      if (!updated) return res.status(404).json({ msg: 'Item not found' });
      res.json({ msg: 'Deleted' });
    } catch (err) { next(err); }
  },
);

// =====================================================================
// Orders: list for a supplier + per-order status update + analytics
// =====================================================================
router.get('/orders',
  requireAuth,
  requireRole('supplier'),
  async (req, res, next) => {
    try {
      const orders = await Order.find({ supplierId: req.user._id })
        .populate('vendorId', 'name location')
        .sort({ date: -1 });
      res.json(orders);
    } catch (err) { next(err); }
  },
);

const statusSchema = z.object({
  status: z.enum(Order.STATUSES),
});

router.patch('/orders/:orderId/status',
  requireAuth,
  requireRole('supplier'),
  validate({ params: z.object({ orderId: objectId }), body: statusSchema }),
  async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.orderId);
      if (!order) return res.status(404).json({ msg: 'Order not found' });
      if (String(order.supplierId) !== String(req.user._id)) {
        return res.status(403).json({ msg: 'That is not your order' });
      }

      const from = order.status || 'Pending';
      const to = req.body.status;
      if (!Order.canTransition(from, to)) {
        return res.status(409).json({ msg: `An order cannot go from ${from} to ${to}` });
      }

      if (to === 'Rejected' || to === 'Cancelled') {
        await releaseOrderStock(order);
      }
      order.status = req.body.status;
      order.statusHistory.push({ status: req.body.status });
      await order.save();

      await notifySafely(order.vendorId, {
        type: 'order_status',
        title: `Your ${order.itemName} order ${STATUS_WORDING[to] || `is now ${to}`}`,
        body: `${order.quantity} ${order.unit || 'kg'} from ${req.user.name}`,
        orderId: order._id,
        email: EMAIL_ON_STATUS.has(to),
      });

      res.json({ msg: 'Status updated', order });
    } catch (err) { next(err); }
  },
);

router.get('/supplier/analytics',
  requireAuth,
  requireRole('supplier'),
  async (req, res, next) => {
    try {
      const supplierId = req.user._id;
      const orders = await Order.find({ supplierId });
      const totalRevenue = orders
        .filter(o => o.status !== 'Rejected' && o.status !== 'Cancelled')
        .reduce((sum, o) => sum + (o.quantity || 0) * (o.price || 0), 0);
      const counts = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {});
      // Last 7 days revenue by day
      const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      since.setHours(0, 0, 0, 0);
      const daily = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
        daily[d.toISOString().slice(0, 10)] = 0;
      }
      orders.forEach(o => {
        if (!o.date) return;
        const key = new Date(o.date).toISOString().slice(0, 10);
        if (key in daily && o.status !== 'Rejected' && o.status !== 'Cancelled') {
          daily[key] += (o.quantity || 0) * (o.price || 0);
        }
      });
      res.json({
        totalRevenue,
        totalOrders: orders.length,
        statusCounts: counts,
        daily: Object.entries(daily).map(([day, revenue]) => ({ day, revenue })),
      });
    } catch (err) { next(err); }
  },
);

module.exports = router;
