const mongoose = require('mongoose');
require('dotenv').config();

const clientOptions = {
  serverApi: { version: '1', strict: true, deprecationErrors: true },
};

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, clientOptions);
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log('✅ Connected to MongoDB Atlas');

    // Reconcile indexes with current schemas (drops stale unique indexes if any)
    try {
      const Order = require('../models/Order');
      await Order.syncIndexes();
    } catch (err) {
      console.warn('⚠️  Order.syncIndexes() failed:', err.message);
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
  }
}

module.exports = connectDB;
