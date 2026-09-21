const mongoose = require('mongoose');

// A vendor asking to hear when an out-of-stock listing comes back. Fired once —
// the restock deletes the subscription, so nobody is nagged twice.
const stockAlertSchema = new mongoose.Schema({
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
  // Snapshot, so the alert still reads correctly if the listing is renamed.
  itemName: String,
}, { timestamps: true });

// One subscription per vendor per listing; a repeat tap is a no-op, not a dupe.
stockAlertSchema.index({ vendorId: 1, itemId: 1 }, { unique: true });
// The restock path looks subscriptions up by listing.
stockAlertSchema.index({ itemId: 1 });

module.exports = mongoose.model('StockAlert', stockAlertSchema);
