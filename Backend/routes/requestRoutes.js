const express = require('express');
const router = express.Router();
const { z } = require('zod');
const fileUpload = require('express-fileupload');
const cloudinary = require('cloudinary').v2;
const Order = require('../models/Order');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { placeOrders, releaseOrderStock } = require('../services/orders');
const { notifySafely } = require('../services/notifications');
const { fetchMandiPrices } = require('../services/mandi');
const { SLOTS } = require('../lib/slots');

const { objectId } = require('../lib/ids');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 5 MB hard cap on uploads
router.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 },
  abortOnLimit: true,
  responseOnLimit: 'File too large (max 5 MB)',
}));

// =====================================================================
// Image upload (Cloudinary)
// =====================================================================
router.post('/upload', requireAuth, async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ msg: 'No file uploaded.' });
    }
    const uploadedFile = req.files.myImage;
    if (!uploadedFile.mimetype?.startsWith('image/')) {
      return res.status(400).json({ msg: 'Only image files are allowed.' });
    }
    const b64 = Buffer.from(uploadedFile.data).toString('base64');
    const dataURI = `data:${uploadedFile.mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataURI, { folder: 'VendorVerseImages' });
    res.json({ msg: 'Upload successful', imageUrl: result.secure_url });
  } catch (err) { next(err); }
});

// =====================================================================
// Orders
// =====================================================================
const placeOrderSchema = z.object({
  supplierId: objectId,
  itemId: objectId,
  quantity: z.number().int().positive(),
});

// Falls back to the vendor's own location when checkout leaves it blank.
const deliverySchema = {
  deliveryAddress: z.string().max(300).optional(),
  deliverySlot: z.enum(SLOTS).optional(),
  notes: z.string().max(1000).optional(),
};

// Single order
router.post('/placeOrder',
  requireAuth,
  requireRole('vendor'),
  validate({ body: placeOrderSchema.extend(deliverySchema) }),
  async (req, res, next) => {
    try {
      const { deliveryAddress, deliverySlot, notes, ...line } = req.body;
      const [order] = await placeOrders(req.user, [line], { deliveryAddress, deliverySlot, notes });
      res.status(201).json({ msg: 'Order placed', order });
    } catch (err) { next(err); }
  },
);

// Bulk: place many orders in one go (for cart checkout)
router.post('/placeOrders',
  requireAuth,
  requireRole('vendor'),
  validate({ body: z.object({ items: z.array(placeOrderSchema).min(1), ...deliverySchema }) }),
  async (req, res, next) => {
    try {
      const { items, deliveryAddress, deliverySlot, notes } = req.body;
      const created = await placeOrders(req.user, items, { deliveryAddress, deliverySlot, notes });
      res.status(201).json({ msg: 'Orders placed', count: created.length, orders: created });
    } catch (err) { next(err); }
  },
);

router.get('/vendor/orders',
  requireAuth,
  requireRole('vendor'),
  async (req, res, next) => {
    try {
      // Same shape the list actually renders: no transition log, no hydration.
      const orders = await Order.find({ vendorId: req.user._id })
        .select('-statusHistory')
        .populate('supplierId', 'name location')
        .sort({ date: -1 })
        .lean();
      res.json(orders);
    } catch (err) { next(err); }
  },
);

router.get('/orders/:orderId',
  requireAuth,
  validate({ params: z.object({ orderId: objectId }) }),
  async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.orderId)
        .populate('supplierId', 'name location email')
        .populate('vendorId', 'name location email');
      if (!order) return res.status(404).json({ msg: 'Order not found' });

      const me = String(req.user._id);
      const isParty = me === String(order.vendorId?._id || order.vendorId)
                   || me === String(order.supplierId?._id || order.supplierId);
      if (!isParty) return res.status(403).json({ msg: 'That is not your order' });

      res.json(order);
    } catch (err) { next(err); }
  },
);

// A vendor may back out only while the supplier has not acted yet. After that
// the Help page tells them to get in touch, which matches this rule.
router.post('/orders/:orderId/cancel',
  requireAuth,
  requireRole('vendor'),
  validate({ params: z.object({ orderId: objectId }) }),
  async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.orderId);
      if (!order) return res.status(404).json({ msg: 'Order not found' });
      if (String(order.vendorId) !== String(req.user._id)) {
        return res.status(403).json({ msg: 'That is not your order' });
      }
      if ((order.status || 'Pending') !== 'Pending') {
        return res.status(409).json({
          msg: `This order is already ${order.status}, so it can no longer be cancelled here`,
        });
      }

      await releaseOrderStock(order);
      order.status = 'Cancelled';
      order.statusHistory.push({ status: 'Cancelled' });
      await order.save();

      await notifySafely(order.supplierId, {
        type: 'order_cancelled',
        title: `${req.user.name} cancelled an order`,
        body: `${order.quantity} ${order.unit || 'kg'} ${order.itemName} · the stock is back in your inventory`,
        orderId: order._id,
        email: true, // they may already be packing it
      });

      res.json({ msg: 'Order cancelled', order });
    } catch (err) { next(err); }
  },
);

router.get('/vendor/analytics',
  requireAuth,
  requireRole('vendor'),
  async (req, res, next) => {
    try {
      // Reduced in the database — the vendor's order history never leaves it.
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const lineTotal = { $multiply: [{ $ifNull: ['$quantity', 0] }, { $ifNull: ['$price', 0] }] };
      const spent = { $cond: [{ $in: ['$status', ['Rejected', 'Cancelled']] }, 0, lineTotal] };
      const [agg] = await Order.aggregate([
        { $match: { vendorId: req.user._id } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalOrders: { $sum: 1 },
                  totalSpend: { $sum: spent },
                  weekSpend: { $sum: { $cond: [{ $gte: ['$date', weekAgo] }, spent, 0] } },
                },
              },
            ],
            statusCounts: [
              { $group: { _id: '$status', n: { $sum: 1 } } },
            ],
          },
        },
      ]);
      res.json({
        totalOrders: agg.totals[0]?.totalOrders || 0,
        totalSpend: agg.totals[0]?.totalSpend || 0,
        weekSpend: agg.totals[0]?.weekSpend || 0,
        statusCounts: Object.fromEntries(agg.statusCounts.map(s => [s._id, s.n])),
      });
    } catch (err) { next(err); }
  },
);

// =====================================================================
// Insights: where the vendor's money actually goes. Every number reduces in
// the database; the mandi comparison is decoration fetched afterwards and
// allowed to fail without taking the page with it.
// =====================================================================
const WEEKS = 8;

// Agmarknet capitalises commodities ("Green Chilli"); order forms rarely do.
const titleCase = (s) => s.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

router.get('/vendor/insights',
  requireAuth,
  requireRole('vendor'),
  async (req, res, next) => {
    try {
      const lineTotal = { $multiply: [{ $ifNull: ['$quantity', 0] }, { $ifNull: ['$price', 0] }] };
      const active = { status: { $nin: ['Rejected', 'Cancelled'] } };

      // Buckets align to Mondays, matching $dateTrunc below.
      const now = new Date();
      const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
      const since = new Date(monday.getTime() - (WEEKS - 1) * 7 * 24 * 60 * 60 * 1000);

      const [agg] = await Order.aggregate([
        { $match: { vendorId: req.user._id } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalOrders: { $sum: 1 },
                  totalSpend: { $sum: { $cond: [{ $in: ['$status', ['Rejected', 'Cancelled']] }, 0, lineTotal] } },
                  activeOrders: { $sum: { $cond: [{ $in: ['$status', ['Rejected', 'Cancelled']] }, 0, 1] } },
                  suppliers: { $addToSet: '$supplierId' },
                },
              },
            ],
            weekly: [
              { $match: { ...active, date: { $gte: since } } },
              {
                $group: {
                  _id: { $dateTrunc: { date: '$date', unit: 'week', startOfWeek: 'monday' } },
                  spend: { $sum: lineTotal },
                },
              },
            ],
            topItems: [
              { $match: active },
              {
                $group: {
                  _id: { $toLower: '$itemName' },
                  name: { $first: '$itemName' },
                  unit: { $first: '$unit' },
                  spend: { $sum: lineTotal },
                  qty: { $sum: { $ifNull: ['$quantity', 0] } },
                  orders: { $sum: 1 },
                },
              },
              { $sort: { spend: -1 } },
              { $limit: 6 },
              { $project: { _id: 0, name: 1, unit: 1, spend: 1, qty: 1, orders: 1 } },
            ],
            topSuppliers: [
              { $match: active },
              { $group: { _id: '$supplierId', spend: { $sum: lineTotal }, orders: { $sum: 1 } } },
              { $sort: { spend: -1 } },
              { $limit: 5 },
              { $lookup: { from: 'supplierdatas', localField: '_id', foreignField: '_id', as: 'user' } },
              {
                $project: {
                  _id: 0,
                  supplierId: '$_id',
                  spend: 1,
                  orders: 1,
                  name: { $ifNull: [{ $first: '$user.name' }, 'Former supplier'] },
                  location: { $first: '$user.location' },
                },
              },
            ],
          },
        },
      ]);

      // Quiet weeks still get a bar, so the chart always spans two months.
      const bySpend = new Map(agg.weekly.map(w => [new Date(w._id).toISOString().slice(0, 10), w.spend]));
      const weekly = [...Array(WEEKS)].map((_, i) => {
        const weekStart = new Date(since.getTime() + i * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return { weekStart, spend: bySpend.get(weekStart) || 0 };
      });

      // "You pay ₹38/kg, the mandi says ₹27" — only meaningful for items
      // bought by the kilo, and only when Agmarknet knows the name.
      const topItems = agg.topItems;
      await Promise.all(topItems.filter(i => (i.unit || 'kg') === 'kg' && i.qty > 0).slice(0, 3)
        .map(async (item) => {
          try {
            const mandi = await fetchMandiPrices(titleCase(item.name));
            if (mandi.medianPerKg != null) {
              item.mandiPerKg = mandi.medianPerKg;
              item.paidPerKg = Math.round((item.spend / item.qty) * 100) / 100;
            }
          } catch { /* the comparison is decoration */ }
        }));

      const t = agg.totals[0] || {};
      res.json({
        totalSpend: t.totalSpend || 0,
        totalOrders: t.totalOrders || 0,
        activeOrders: t.activeOrders || 0,
        supplierCount: (t.suppliers || []).length,
        avgOrderValue: t.activeOrders ? Math.round(t.totalSpend / t.activeOrders) : 0,
        weekly,
        topItems,
        topSuppliers: agg.topSuppliers,
      });
    } catch (err) { next(err); }
  },
);

module.exports = router;
