const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
    type: {
      type: String,
      enum: ['like', 'submission_status', 'exhibit', 'artwork_restored', 'artwork_review', 'role_change'],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    artwork: { type: mongoose.Schema.Types.ObjectId, ref: 'Artwork', default: null },
    exhibit: { type: mongoose.Schema.Types.ObjectId, ref: 'Exhibit', default: null },
    isRead: { type: Boolean, default: false, index: true },
    dedupe_key: { type: String, default: null },
  },
  { timestamps: true, collection: 'notifications' },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, dedupe_key: 1 }, { unique: true, partialFilterExpression: { dedupe_key: { $type: 'string' } } });

module.exports = mongoose.model('Notification', notificationSchema);
