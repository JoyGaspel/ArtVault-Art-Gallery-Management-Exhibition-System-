const mongoose = require('mongoose');
const SubmitExhibitEntry = require('../models/SubmitExhibitEntry');
const Artist = require('../models/Artist');
const AdminProfile = require('../models/AdminProfile');

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
    // Backfill the additive admin directory without changing existing artist
    // accounts, roles, passwords, artwork ownership, or audit references.
    const existingAdmins = await Artist.find({ role: { $in: ['sub_admin', 'main_admin'] } }).select('_id role status').lean();
    for (const admin of existingAdmins) {
      await AdminProfile.updateOne(
        { artistId: admin._id },
        { $set: { role: admin.role, status: admin.status === 'suspended' ? 'suspended' : 'active' }, $setOnInsert: { promotedAt: new Date() } },
        { upsert: true },
      );
    }
    await AdminProfile.syncIndexes();
    console.log(`Admin profile directory synchronized: ${existingAdmins.length} account(s)`);
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
