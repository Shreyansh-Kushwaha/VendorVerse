const mongoose = require('mongoose');

// One row per price a listing has ever had — written when the item is listed
// and whenever the supplier changes the price. Orders already snapshot the
// price they were placed at; this is the listing's own timeline.
const priceHistorySchema = new mongoose.Schema({
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierData',
    required: true,
  },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  price: { type: Number, required: true },
  unit: String,
  at: { type: Date, default: Date.now },
});

// The only query is "this listing's prices, oldest first".
priceHistorySchema.index({ itemId: 1, at: 1 });

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
