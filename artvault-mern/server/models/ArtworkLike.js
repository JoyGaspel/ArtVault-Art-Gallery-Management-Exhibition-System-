const mongoose = require('mongoose');

const artworkLikeSchema = new mongoose.Schema(
  {
    artwork: { type: mongoose.Schema.Types.ObjectId, ref: 'Artwork', required: true, index: true },
    artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  },
  { timestamps: true, collection: 'artwork_likes' },
);

// One artist can like a particular artwork only once.
artworkLikeSchema.index({ artwork: 1, artist: 1 }, { unique: true });
artworkLikeSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ArtworkLike', artworkLikeSchema);
