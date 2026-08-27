const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const { notifySafely } = require('./notifications');

const describeLine = (o) => `${o.quantity} ${o.unit || 'kg'} ${o.itemName}`;

class OrderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Take `qty` off an item, but only if that much is actually there. The filter and
// the $inc happen in one atomic document update, so two vendors racing for the
// last crate cannot both win.
async function reserveStock(supplierId, itemId, qty) {
  const doc = await Supplier.findOneAndUpdate(
    { supplierId, inventory: { $elemMatch: { _id: itemId, quantity: { $gte: qty } } } },
    { $inc: { 'inventory.$.quantity': -qty } },
    { new: true },
  );
  return doc ? doc.inventory.id(itemId) : null;
}

async function releaseStock(supplierId, itemId, qty) {
  await Supplier.updateOne(
    { supplierId, 'inventory._id': itemId },
    { $inc: { 'inventory.$.quantity': qty } },
  );
}

async function describeFailure(supplierId, itemId, qty) {
  const doc = await Supplier.findOne({ supplierId, 'inventory._id': itemId });
  const item = doc?.inventory?.id(itemId);
  if (!item) return new OrderError(404, 'That item is no longer listed');
  const u = item.unit || 'kg';
  return new OrderError(409, `Only ${item.quantity} ${u} left of ${item.itemName}, you asked for ${qty} ${u}`);
}

// The client sends what it wants to buy. Name and price are read off the listing
// so a tampered or stale cart cannot dictate either.
async function placeOrders(vendor, lines, { deliveryAddress, notes } = {}) {
  const address = (deliveryAddress || '').trim() || vendor.location;
  const reserved = [];
  const docs = [];

  try {
    for (const line of lines) {
      const item = await reserveStock(line.supplierId, line.itemId, line.quantity);
      if (!item) throw await describeFailure(line.supplierId, line.itemId, line.quantity);

      reserved.push(line);
      docs.push({
        vendorId: vendor._id,
        supplierId: line.supplierId,
        deliveryAddress: address,
        notes: notes?.trim() || undefined,
        itemId: line.itemId,
        itemName: item.itemName,
        quantity: line.quantity,
        price: item.price,
        unit: item.unit,
        statusHistory: [{ status: 'Pending' }],
      });
    }

    const created = await Order.insertMany(docs);

    // One ping per supplier, not one per line, so a five item cart does not
    // land as five separate alerts.
    const bySupplier = new Map();
    for (const o of created) {
      const key = String(o.supplierId);
      if (!bySupplier.has(key)) bySupplier.set(key, []);
      bySupplier.get(key).push(o);
    }
    await Promise.all([...bySupplier.entries()].map(([supplierId, group]) =>
      notifySafely(supplierId, {
        type: 'order_placed',
        title: `New order from ${vendor.name}`,
        body: group.length === 1
          ? describeLine(group[0])
          : `${group.length} items · ${group.map(describeLine).join(', ')}`,
        orderId: group[0]._id,
      })));

    return created;
  } catch (err) {
    // Put back everything this attempt took so a partial failure leaves no hole.
    await Promise.all(reserved.map(r =>
      releaseStock(r.supplierId, r.itemId, r.quantity).catch(() => {})));
    throw err;
  }
}

// A rejected or cancelled order must hand its stock back, exactly once.
async function releaseOrderStock(order) {
  if (order.stockReleased) return;
  await releaseStock(order.supplierId, order.itemId, order.quantity);
  order.stockReleased = true;
}

module.exports = { placeOrders, releaseOrderStock, OrderError };
