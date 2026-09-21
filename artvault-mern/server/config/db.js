const mongoose = require('mongoose');
const SubmitExhibitEntry = require('../models/SubmitExhibitEntry');

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy .env.example to .env and fill it in.');
  }

  mongoose.set('strictQuery', true);
  // Prevent query selector objects supplied by clients from becoming MongoDB
  // operators (for example, an unexpected $where/$gt filter).
  mongoose.set('sanitizeFilter', true);

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    // Replace the original one-entry-per-artwork index so denied entries can
    // use the second attempt without allowing duplicate pending submissions.
    await SubmitExhibitEntry.syncIndexes();
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
