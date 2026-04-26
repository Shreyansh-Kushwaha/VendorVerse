const mongoose = require('mongoose');

const ORDER_STATUSES = ['Pending', 'Accepted', 'Packed', 'OutForDelivery', 'Delivered', 'Rejected', 'Cancelled'];

const orderSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierData',
    required: true,
    index: true,
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierData',
    required: true,
    index: true,
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
  statusHistory: [{
    status: { type: String, enum: ORDER_STATUSES },
    at: { type: Date, default: Date.now },
  }],
});

orderSchema.statics.STATUSES = ORDER_STATUSES;

module.exports = mongoose.model('Order', orderSchema);
