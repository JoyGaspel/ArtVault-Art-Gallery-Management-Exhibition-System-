const mongoose = require('mongoose');

function isPrivateArtwork(artwork) {
  return artwork?.visibility === 'private';
}

function publicArtworkFilter() {
  // Legacy artwork documents have no visibility field and must stay public.
  return { visibility: mongoose.trusted({ $ne: 'private' }) };
}

function canViewArtwork(artwork, user) {
  if (!artwork) return false;
  if (!isPrivateArtwork(artwork)) return true;
  return Boolean(user && (
    String(artwork.artist) === String(user._id)
    || user.role === 'main_admin'
  ));
}

module.exports = { isPrivateArtwork, publicArtworkFilter, canViewArtwork };
