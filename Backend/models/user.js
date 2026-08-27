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
  // Only the hash of the reset token is stored, so a database leak does not
  // hand somebody a working password reset link.
  resetTokenHash: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
  // Any session issued before this moment is treated as stale.
  passwordChangedAt: { type: Date },
}, { timestamps: true }); 

module.exports = mongoose.model('SupplierData', userSchema);
