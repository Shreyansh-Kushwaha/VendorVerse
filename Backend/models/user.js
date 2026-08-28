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
  // 'admin' exists in the enum but not in the registration schema — the only
  // way to mint one is scripts/makeAdmin.js against the database.
  userType: {
    type: String,
    enum: ['vendor', 'supplier', 'admin'],
    required: true,
  },
  // Set by an admin. A suspended account cannot sign in, keeps no live
  // session, and cannot be sold to.
  suspended: { type: Boolean, default: false },
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
