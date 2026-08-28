
const mongoose = require('mongoose');
const { UNITS, DEFAULT_UNIT } = require('../lib/units');

const supplierSchema = new mongoose.Schema({
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SupplierData",
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true
  },
  inventory: [
    {
      itemName: String,
      quantity: Number,
      price: Number,
      unit: { type: String, enum: UNITS, default: DEFAULT_UNIT },
      category: String,
      imageUrl: String
    }
  ],
  location: {
    type: String,
    required: true
  },
  // Where the supplier actually is, captured (with permission) when they list
  // stock. Optional — a supplier without coordinates simply never appears in
  // "near me" results.
  geo: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number], default: undefined }, // [lng, lat]
  },
});

// Powers $geoNear. Docs without a geo point are simply not in the index.
supplierSchema.index({ geo: '2dsphere' });

module.exports = mongoose.model('Supplier', supplierSchema);
