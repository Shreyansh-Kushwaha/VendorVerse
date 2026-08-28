const mongoose = require('mongoose');

// One review per order, and only for an order that was actually delivered —
// enforced in the route. Purchase-verified by construction: the review hangs
// off the order, not off a free-floating supplier page.
const reviewSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true,
  },
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
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 500 },
}, { timestamps: true });

// A supplier's profile lists their reviews newest first.
reviewSchema.index({ supplierId: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
