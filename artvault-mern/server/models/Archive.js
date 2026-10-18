const mongoose = require('mongoose');

const archiveSchema = new mongoose.Schema({
  entityType: { type: String, enum: ['artist', 'artwork', 'exhibit'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  deletedAt: { type: Date, default: Date.now },
  // Set only when an artist removes their own artwork. After this deadline,
  // the record remains in the administrator archive but is no longer self-restorable.
  artistRecoverUntil: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Archive', archiveSchema);
