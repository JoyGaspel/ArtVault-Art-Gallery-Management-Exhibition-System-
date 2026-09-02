const mongoose = require('mongoose');

const archiveSchema = new mongoose.Schema({
  entityType: { type: String, enum: ['artist', 'artwork', 'exhibit'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  deletedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Archive', archiveSchema);
