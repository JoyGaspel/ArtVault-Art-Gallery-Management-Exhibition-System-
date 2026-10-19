const mongoose = require('mongoose');

function isPrivateArtwork(artwork) {
  return artwork?.visibility === 'private' || ['pending', 'rejected'].includes(artwork?.reviewStatus);
}

function publicArtworkFilter() {
  // Legacy artwork documents have no visibility field and must stay public.
  return { visibility: mongoose.trusted({ $ne: 'private' }), reviewStatus: mongoose.trusted({ $nin: ['pending', 'rejected'] }) };
}

function canViewArtwork(artwork, user) {
  if (!artwork) return false;
  if (!isPrivateArtwork(artwork)) return true;
  return Boolean(user && (
    String(artwork.artist) === String(user._id)
    || user.role === 'main_admin'
    || user.role === 'sub_admin'
  ));
}

module.exports = { isPrivateArtwork, publicArtworkFilter, canViewArtwork };
