const mongoose = require('mongoose');

const artworkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 50 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    image_path: { type: String, trim: true, default: '' },
    thumbnail_path: { type: String, trim: true, default: '' },
    // Private upload evidence; never included in ordinary artwork queries.
    ownership_evidence_path: { type: String, select: false, default: '' },
    artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
    // Existing documents without this field remain public for compatibility.
    visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },
    reviewStatus: { type: String, enum: ['pending', 'rejected', 'clear'], default: 'clear', index: true },
    reviewReason: { type: String, enum: ['', 'possible_match', 'check_unavailable'], default: '' },
    webMatchUrls: { type: [String], select: false, default: [] },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', default: null },
    ownershipDeclared: { type: Boolean, default: false },
    ownershipDeclaredAt: { type: Date, default: null },
    categories: { type: [String], default: [] },
    materials: { type: [String], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

artworkSchema.index({ artist: 1 });
artworkSchema.index({ artist: 1, visibility: 1, created_at: -1 });
artworkSchema.index({ categories: 1 });
artworkSchema.index({ created_at: -1 });

module.exports = mongoose.model('Artwork', artworkSchema);
