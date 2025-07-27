const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  vendorId: {
    type: String,
    ref: 'User',
    required: true
  },
  items: [
    {
      name: String,
      quantity: Number
    }
  ],
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Request', requestSchema);
