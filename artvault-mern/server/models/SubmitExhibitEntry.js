const mongoose = require('mongoose');

const submitExhibitEntrySchema = new mongoose.Schema(
  {
    artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
    artwork: { type: mongoose.Schema.Types.ObjectId, ref: 'Artwork', required: true, index: true },
    exhibit: { type: mongoose.Schema.Types.ObjectId, ref: 'Exhibit', required: true, index: true },
    status: { type: String, enum: ['pending', 'approved', 'denied', 'withdrawn'], default: 'pending', index: true },
    denial_reason: { type: String, trim: true, maxlength: 500, default: '' },
    decided_at: { type: Date, default: null },
    decided_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', default: null },
  },
  { timestamps: true, collection: 'Submit_Exhibit_Entry' },
);

// Keep the combination indexed, but allow a second attempt after a denial.
submitExhibitEntrySchema.index({ artist: 1, artwork: 1, exhibit: 1, createdAt: -1 });

module.exports = mongoose.model('Submit_Exhibit_Entry', submitExhibitEntrySchema);
