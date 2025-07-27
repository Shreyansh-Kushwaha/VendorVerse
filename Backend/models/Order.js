// models/Order.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SupplierData",
    required: true,
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SupplierData",
    required: true,
  },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemName: String,
  quantity: Number,
  price: Number,
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);
