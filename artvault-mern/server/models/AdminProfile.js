const mongoose = require('mongoose');

// Admin-specific grouping kept separate from the existing artist accounts.
// The artist document remains the source of identity, authentication, and
// artwork ownership; this collection is an additive admin directory.
const adminProfileSchema = new mongoose.Schema(
  {
    artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, unique: true, index: true },
    role: { type: String, enum: ['sub_admin', 'main_admin'], required: true },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active', index: true },
    promotedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'admin_profiles' },
);

adminProfileSchema.index({ role: 1, status: 1 });

module.exports = mongoose.model('AdminProfile', adminProfileSchema);
