const mongoose = require('mongoose');
const Artwork = require('../models/Artwork');
const ArtworkLike = require('../models/ArtworkLike');
const Notification = require('../models/Notification');
const { recordAudit } = require('../utils/audit');
const { sendNotificationEmailInBackground } = require('../services/notificationEmailService');
const { publicArtworkFilter } = require('../utils/artworkVisibility');

async function countLikes(artworkId) {
  return ArtworkLike.countDocuments({ artwork: artworkId });
}

// POST /api/artworks/:id/likes (artists only)
async function likeArtwork(req, res, next) {
  try {
    const artwork = await Artwork.findOne({ _id: req.params.id, ...publicArtworkFilter() }).select('_id artist title');
    if (!artwork) return res.status(404).json({ message: 'Artwork not found.' });
    let created = false;
    try {
      await ArtworkLike.create({ artwork: artwork._id, artist: req.user._id });
      created = true;
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    if (created && String(artwork.artist) !== String(req.user._id)) {
      Notification.create({
        recipient: artwork.artist,
        type: 'like',
        title: 'Your artwork received a like',
        message: `${req.user.name || 'An artist'} liked “${artwork.title}”.`,
        artwork: artwork._id,
      }).then((notification) => sendNotificationEmailInBackground(notification))
        .catch((error) => console.error('Like notification could not be created:', error.message));
    }
    res.json({ liked: true, likeCount: await countLikes(artwork._id) });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/artworks/:id/likes (artists only)
async function unlikeArtwork(req, res, next) {
  try {
    const artwork = await Artwork.findOne({ _id: req.params.id, ...publicArtworkFilter() }).select('_id');
    if (!artwork) return res.status(404).json({ message: 'Artwork not found.' });
    await ArtworkLike.deleteOne({ artwork: artwork._id, artist: req.user._id });
    res.json({ liked: false, likeCount: await countLikes(artwork._id) });
  } catch (error) {
    next(error);
  }
}

// GET /api/artworks/:id/likes/me (artists only)
async function getMyLikeStatus(req, res, next) {
  try {
    if (!(await Artwork.exists({ _id: req.params.id, ...publicArtworkFilter() }))) return res.status(404).json({ message: 'Artwork not found.' });
    const artworkId = new mongoose.Types.ObjectId(req.params.id);
    const [liked, likeCount] = await Promise.all([
      ArtworkLike.exists({ artwork: artworkId, artist: req.user._id }),
      countLikes(artworkId),
    ]);
    res.json({ liked: Boolean(liked), likeCount });
  } catch (error) {
    next(error);
  }
}

// GET /api/likes (administrator activity page)
async function listLikes(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const [likes, total] = await Promise.all([
      ArtworkLike.aggregate([
        { $sort: { createdAt: -1 } },
        { $lookup: { from: 'artworks', localField: 'artwork', foreignField: '_id', as: 'artwork' } },
        { $unwind: '$artwork' },
        ...(req.user.role === 'main_admin' ? [] : [{ $match: { 'artwork.visibility': { $ne: 'private' } } }]),
        { $skip: skip }, { $limit: limit },
        { $lookup: { from: 'artists', localField: 'artist', foreignField: '_id', as: 'artist' } },
        { $unwind: '$artist' },
        { $project: {
          _id: 1, artwork: { _id: '$artwork._id', title: '$artwork.title', visibility: '$artwork.visibility', categories: '$artwork.categories', has_image: { $gt: [{ $strLenCP: { $ifNull: ['$artwork.image_path', ''] } }, 0] }, updated_at: '$artwork.updated_at' },
          artist: { _id: '$artist._id', name: '$artist.name' }, createdAt: 1,
        } },
      ]),
      req.user.role === 'main_admin' ? ArtworkLike.countDocuments() : ArtworkLike.aggregate([
        { $lookup: { from: 'artworks', localField: 'artwork', foreignField: '_id', as: 'artwork' } },
        { $unwind: '$artwork' }, { $match: { 'artwork.visibility': { $ne: 'private' } } }, { $count: 'count' },
      ]).then((rows) => rows[0]?.count || 0),
    ]);
    const imageOrigin = `${req.protocol}://${req.get('host')}`;
    const result = likes.map((like) => ({
      ...like,
      artwork: {
        ...like.artwork,
        image_url: like.artwork.has_image && like.artwork.visibility !== 'private' ? `${imageOrigin}/api/artworks/${like.artwork._id}/image?v=${encodeURIComponent(like.artwork.updated_at || '')}` : '',
        thumbnail_url: like.artwork.has_image && like.artwork.visibility !== 'private' ? `${imageOrigin}/api/artworks/${like.artwork._id}/thumbnail?v=${encodeURIComponent(like.artwork.updated_at || '')}` : '',
      },
    }));
    res.json({ likes: result, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/likes/:id (main administrator only)
async function removeLike(req, res, next) {
  try {
    const like = await ArtworkLike.findByIdAndDelete(req.params.id).populate('artwork', 'title');
    if (!like) return res.status(404).json({ message: 'Like activity not found.' });
    await recordAudit({ req, action: 'delete', entityType: 'artwork_like', entityId: like._id, details: { artwork: like.artwork?.title || 'Artwork' } });
    res.json({ message: 'Like removed.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { likeArtwork, unlikeArtwork, getMyLikeStatus, listLikes, removeLike };
