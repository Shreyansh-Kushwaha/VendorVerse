const StockAlert = require('../models/StockAlert');
const { notifySafely } = require('./notifications');

// Called when a listing goes from empty back to stocked. Subscriptions are
// deleted before the notifications go out, so a second restock in quick
// succession cannot mail the same vendor twice.
async function fireRestockAlerts(supplierName, item) {
  const alerts = await StockAlert.find({ itemId: item._id });
  if (alerts.length === 0) return;
  await StockAlert.deleteMany({ itemId: item._id });

  const u = item.unit || 'kg';
  await Promise.all(alerts.map((a) => notifySafely(a.vendorId, {
    type: 'stock',
    title: `${item.itemName} is back in stock`,
    body: `${supplierName} has ${item.quantity} ${u} at ₹${item.price}/${u}`,
    email: true, // the whole point is reaching a vendor who is not looking
  })));
}

module.exports = { fireRestockAlerts };
