const mongoose = require('mongoose');
require('dotenv').config();

const clientOptions = {
  serverApi: { version: '1', strict: true, deprecationErrors: true },
};

async function connectDB() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not set. See Backend/.env.example');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, clientOptions);
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    // Booting without a database used to leave the process listening and
    // answering health checks while every route timed out.
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }

  // Reconcile indexes with current schemas. Never fatal — a stale index should
  // not stop the app from serving.
  for (const model of ['Order', 'Supplier', 'Notification']) {
    try {
      await require(`../models/${model}`).syncIndexes();
    } catch (err) {
      console.warn(`⚠️  ${model}.syncIndexes() failed:`, err.message);
    }
  }
}

module.exports = connectDB;
