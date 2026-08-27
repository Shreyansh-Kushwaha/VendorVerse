const mongoose = require('mongoose');

const ORDER_STATUSES = ['Pending', 'Accepted', 'Packed', 'OutForDelivery', 'Delivered', 'Rejected', 'Cancelled'];

const orderSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierData',
    required: true,
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierData',
    required: true,
  },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemName: String,
  quantity: Number,
  price: Number,
  date: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ORDER_STATUSES,
    default: 'Pending',
  },
  // Set once the stock for this order has been handed back, so a repeated
  // reject or cancel cannot inflate inventory.
  stockReleased: { type: Boolean, default: false },
  statusHistory: [{
    status: { type: String, enum: ORDER_STATUSES },
    at: { type: Date, default: Date.now },
  }],
});

// Both dashboards filter by one party and sort by date. A compound index serves
// the filter and the sort in one pass.
orderSchema.index({ supplierId: 1, date: -1 });
orderSchema.index({ vendorId: 1, date: -1 });

orderSchema.statics.STATUSES = ORDER_STATUSES;

module.exports = mongoose.model('Order', orderSchema);
