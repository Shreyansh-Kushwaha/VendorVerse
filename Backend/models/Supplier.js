
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
  }
  
  
});

module.exports = mongoose.model('Supplier', supplierSchema);
