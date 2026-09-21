const mongoose = require('mongoose');

const TYPES = ['order_placed', 'order_status', 'order_cancelled', 'review', 'stock'];

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplierData',
    required: true,
  },
  type: { type: String, enum: TYPES, required: true },
  title: { type: String, required: true },
  body: { type: String },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  read: { type: Boolean, default: false },
}, { timestamps: true });

// The only query is "my notifications, newest first", plus an unread count.
notificationSchema.index({ userId: 1, createdAt: -1 });

notificationSchema.statics.TYPES = TYPES;

module.exports = mongoose.model('Notification', notificationSchema);
