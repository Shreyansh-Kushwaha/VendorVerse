
const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SupplierData",
    required: true,
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
