const Supplier = require('../models/Supplier');
const Order = require('../models/Order');

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
  return new OrderError(409, `Only ${item.quantity} left of ${item.itemName}, you asked for ${qty}`);
}

// The client sends what it wants to buy. Name and price are read off the listing
// so a tampered or stale cart cannot dictate either.
async function placeOrders(vendorId, lines) {
  const reserved = [];
  const docs = [];

  try {
    for (const line of lines) {
      const item = await reserveStock(line.supplierId, line.itemId, line.quantity);
      if (!item) throw await describeFailure(line.supplierId, line.itemId, line.quantity);

      reserved.push(line);
      docs.push({
        vendorId,
        supplierId: line.supplierId,
        itemId: line.itemId,
        itemName: item.itemName,
        quantity: line.quantity,
        price: item.price,
        statusHistory: [{ status: 'Pending' }],
      });
    }

    return await Order.insertMany(docs);
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
