const mongoose = require('mongoose');

const artworkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    image_path: { type: String, trim: true, default: '' },
    artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
    categories: { type: [String], default: [] },
    materials: { type: [String], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

artworkSchema.index({ artist: 1 });
artworkSchema.index({ categories: 1 });
artworkSchema.index({ created_at: -1 });

module.exports = mongoose.model('Artwork', artworkSchema);
