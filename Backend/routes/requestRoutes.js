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

module.exports = router;
