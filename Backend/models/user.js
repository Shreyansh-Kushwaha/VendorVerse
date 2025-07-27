const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  userType: {
    type: String,
    enum: ['vendor', 'supplier'],
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  businessName: {
    type: String,
  },
}, { timestamps: true }); 

module.exports = mongoose.model('SupplierData', userSchema);
