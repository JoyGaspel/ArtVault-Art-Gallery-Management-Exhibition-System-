const mongoose = require('mongoose');

const exhibitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    event_date: { type: Date, required: true },
    starts_at: { type: Date },
    ends_at: { type: Date },
    lifecycle_enabled: { type: Boolean, default: false },
    start_notification_sent_at: { type: Date, default: null },
    end_notification_sent_at: { type: Date, default: null },
    artworks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Artwork' }],
  },
  { timestamps: true }
);

exhibitSchema.index({ event_date: 1 });
// Artwork detail pages use this reverse lookup to show where a piece is
// featured. Keep it indexed as the number of exhibits grows.
exhibitSchema.index({ artworks: 1 });

module.exports = mongoose.model('Exhibit', exhibitSchema);
