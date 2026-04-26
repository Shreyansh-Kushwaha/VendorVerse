const express = require('express');
const router = express.Router();
const { z } = require('zod');
const fileUpload = require('express-fileupload');
const cloudinary = require('cloudinary').v2;
const Request = require('../models/Request');
const Order = require('../models/Order');
const validate = require('../middleware/validate');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

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
router.post('/upload', async (req, res, next) => {
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
// Vendor: open requests (kept for compatibility with old frontend)
// =====================================================================
router.get('/vendor/request',
  validate({ query: z.object({ vendorId: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const orders = await Request.find({ vendorId: req.query.vendorId }).sort({ createdAt: -1 });
      res.json(orders);
    } catch (err) { next(err); }
  },
);

const requestSchema = z.object({
  vendorId: z.string().min(1),
  items: z.array(z.object({ name: z.string(), quantity: z.number() })).min(1),
  notes: z.string().optional(),
});

router.post('/vendor/request',
  validate({ body: requestSchema }),
  async (req, res, next) => {
    try {
      const newRequest = new Request(req.body);
      await newRequest.save();
      res.status(201).json({ msg: 'Request created', request: newRequest });
    } catch (err) { next(err); }
  },
);

// =====================================================================
// Orders
// =====================================================================
const placeOrderSchema = z.object({
  vendorId: objectId,
  supplierId: objectId,
  itemId: objectId,
  itemName: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
});

// Single order
router.post('/placeOrder',
  validate({ body: placeOrderSchema }),
  async (req, res, next) => {
    try {
      const order = new Order({
        ...req.body,
        statusHistory: [{ status: 'Pending' }],
      });
      await order.save();
      res.status(201).json({ msg: 'Order placed', order });
    } catch (err) { next(err); }
  },
);

// Bulk: place many orders in one go (for cart checkout)
router.post('/placeOrders',
  validate({ body: z.object({ items: z.array(placeOrderSchema).min(1) }) }),
  async (req, res, next) => {
    try {
      const docs = req.body.items.map(i => ({ ...i, statusHistory: [{ status: 'Pending' }] }));
      const created = await Order.insertMany(docs);
      res.status(201).json({ msg: 'Orders placed', count: created.length, orders: created });
    } catch (err) { next(err); }
  },
);

router.get('/vendor/orders',
  validate({ query: z.object({ vendorId: objectId }) }),
  async (req, res, next) => {
    try {
      const orders = await Order.find({ vendorId: req.query.vendorId })
        .populate('supplierId', 'name location')
        .sort({ date: -1 });
      res.json(orders);
    } catch (err) { next(err); }
  },
);

router.get('/orders/:orderId',
  validate({ params: z.object({ orderId: objectId }) }),
  async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.orderId)
        .populate('supplierId', 'name location email')
        .populate('vendorId', 'name location email');
      if (!order) return res.status(404).json({ msg: 'Order not found' });
      res.json(order);
    } catch (err) { next(err); }
  },
);

router.get('/vendor/analytics',
  validate({ query: z.object({ vendorId: objectId }) }),
  async (req, res, next) => {
    try {
      const orders = await Order.find({ vendorId: req.query.vendorId });
      const active = orders.filter(o => o.status !== 'Rejected' && o.status !== 'Cancelled');
      const totalSpend = active.reduce((s, o) => s + (o.quantity || 0) * (o.price || 0), 0);
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const weekSpend = active
        .filter(o => o.date && new Date(o.date).getTime() >= weekAgo)
        .reduce((s, o) => s + (o.quantity || 0) * (o.price || 0), 0);
      res.json({
        totalOrders: orders.length,
        totalSpend,
        weekSpend,
        statusCounts: orders.reduce((acc, o) => {
          acc[o.status] = (acc[o.status] || 0) + 1;
          return acc;
        }, {}),
      });
    } catch (err) { next(err); }
  },
);

module.exports = router;
