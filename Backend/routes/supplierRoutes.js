const express = require('express');
const router = express.Router();
const { z } = require('zod');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const User = require('../models/user');
const validate = require('../middleware/validate');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// Helper: ensure a single Supplier doc exists for this supplierId, return it
async function getOrCreateSupplier(supplierId, name, location) {
  let doc = await Supplier.findOne({ supplierId });
  if (!doc) {
    doc = new Supplier({ supplierId, name, location: location || '—', inventory: [] });
    await doc.save();
  }
  return doc;
}

// =====================================================================
// Inventory: add an item (upsert supplier doc + push to inventory array)
// =====================================================================
const addInventorySchema = z.object({
  supplierId: objectId,
  name: z.string().min(1),
  location: z.string().min(1),
  inventory: z.object({
    itemName: z.string().min(1),
    quantity: z.number().int().nonnegative(),
    price: z.number().nonnegative(),
    category: z.string().min(1),
    imageUrl: z.string().url().optional(),
  }),
});

router.post('/suppliers', validate({ body: addInventorySchema }), async (req, res, next) => {
  try {
    const { supplierId, name, location, inventory } = req.body;
    const doc = await getOrCreateSupplier(supplierId, name, location);
    doc.name = name;
    doc.location = location;
    doc.inventory.push(inventory);
    await doc.save();
    const added = doc.inventory[doc.inventory.length - 1];
    res.status(201).json({ msg: 'Item added', item: added, supplier: doc });
  } catch (err) { next(err); }
});

// =====================================================================
// Suppliers: list (public) + per-supplier profile + per-supplier inventory
// =====================================================================
router.get('/suppliers', async (req, res, next) => {
  try {
    const suppliers = await Supplier.find();
    res.json(suppliers);
  } catch (err) { next(err); }
});

router.get('/suppliers/:supplierId',
  validate({ params: z.object({ supplierId: objectId }) }),
  async (req, res, next) => {
    try {
      const { supplierId } = req.params;
      const [user, docs] = await Promise.all([
        User.findById(supplierId).select('-password'),
        Supplier.find({ supplierId }),
      ]);
      if (!user) return res.status(404).json({ msg: 'Supplier not found' });
      const inventory = docs.flatMap(d => d.inventory);
      const location = docs[0]?.location || user.location;
      res.json({
        _id: user._id,
        name: user.name,
        businessName: user.businessName,
        location,
        email: user.email,
        memberSince: user.createdAt,
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
      const docs = await Supplier.find({ supplierId });
      res.json(docs.flatMap(d => d.inventory));
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
  category: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
});

router.patch('/suppliers/:supplierId/inventory/:itemId',
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
      const updated = await Supplier.findOneAndUpdate(
        { supplierId, 'inventory._id': itemId },
        { $set: setObj },
        { new: true },
      );
      if (!updated) return res.status(404).json({ msg: 'Item not found' });
      const item = updated.inventory.id(itemId);
      res.json({ msg: 'Updated', item });
    } catch (err) { next(err); }
  },
);

router.delete('/suppliers/:supplierId/inventory/:itemId',
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
  validate({ query: z.object({ supplierId: objectId }) }),
  async (req, res, next) => {
    try {
      const orders = await Order.find({ supplierId: req.query.supplierId })
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
  validate({ params: z.object({ orderId: objectId }), body: statusSchema }),
  async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.orderId);
      if (!order) return res.status(404).json({ msg: 'Order not found' });
      order.status = req.body.status;
      order.statusHistory.push({ status: req.body.status });
      await order.save();
      res.json({ msg: 'Status updated', order });
    } catch (err) { next(err); }
  },
);

router.get('/supplier/analytics',
  validate({ query: z.object({ supplierId: objectId }) }),
  async (req, res, next) => {
    try {
      const supplierId = req.query.supplierId;
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
