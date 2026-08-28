const mongoose = require('mongoose');
const { SLOTS } = require('../lib/slots');

const ORDER_STATUSES =['Pending', 'Accepted', 'Packed', 'OutForDelivery', 'Delivered', 'Rejected', 'Cancelled'];

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
  // Snapshot of the listing's unit so the order still reads correctly if the
  // supplier later relists the item in something else.
  unit: String,
  date: { type: Date, default: Date.now },
  // Where this goes and anything the vendor wants the supplier to know. Captured
  // at checkout, so it survives a later change to the vendor's profile location.
  deliveryAddress: { type: String, required: true },
  // The window the vendor asked the delivery to land in. Optional — absent
  // means "anytime".
  deliverySlot: { type: String, enum: SLOTS },
  notes: { type: String },
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

// An order moves forward through the flow, or off it into a terminal state.
// Nothing may leave a terminal state or move backwards.
const ALLOWED_TRANSITIONS = {
  Pending:        ['Accepted', 'Rejected', 'Cancelled'],
  Accepted:       ['Packed', 'Cancelled'],
  Packed:         ['OutForDelivery'],
  OutForDelivery: ['Delivered'],
  Delivered:      [],
  Rejected:       [],
  Cancelled:      [],
};

orderSchema.statics.STATUSES = ORDER_STATUSES;
orderSchema.statics.TRANSITIONS = ALLOWED_TRANSITIONS;
orderSchema.statics.canTransition = function (from, to) {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
};

module.exports = mongoose.model('Order', orderSchema);
