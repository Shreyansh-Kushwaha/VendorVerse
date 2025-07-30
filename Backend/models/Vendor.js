const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  // Add more fields if needed like phone, address, etc.
});

module.exports = mongoose.model("Vendor", vendorSchema);
