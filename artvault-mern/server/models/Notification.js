const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
    type: {
      type: String,
      enum: ['like', 'submission_status', 'exhibit'],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    artwork: { type: mongoose.Schema.Types.ObjectId, ref: 'Artwork', default: null },
    exhibit: { type: mongoose.Schema.Types.ObjectId, ref: 'Exhibit', default: null },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: 'notifications' },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
