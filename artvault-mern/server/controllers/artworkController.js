const Artwork = require('../models/Artwork');
const Exhibit = require('../models/Exhibit');
const Archive = require('../models/Archive');
const mongoose = require('mongoose');

// GET /api/artworks?category=&artist=&page=&limit=
async function listArtworks(req, res, next) {
  try {
    const { category, artist } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    // Keep the public gallery responsive while still allowing management pages
    // to request a larger page explicitly.
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 24));
    const filter = {};
    if (category) filter.categories = category;
    if (artist && mongoose.isValidObjectId(artist)) filter.artist = new mongoose.Types.ObjectId(artist);

    const skip = (page - 1) * limit;

    const [artworks, total] = await Promise.all([
      Artwork.aggregate([
        { $match: filter },
        { $sort: { created_at: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $lookup: {
          from: 'artists',
          let: { artistId: '$artist' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$artistId'] } } },
            { $project: { name: 1, specializations: 1 } },
          ],
          as: 'artist',
        } },
        { $project: {
          title: 1, description: 1, categories: 1, materials: 1,
          created_at: 1, updated_at: 1,
          artist: { $arrayElemAt: ['$artist', 0] },
          // Do not send multi-megabyte base64 data in every gallery response.
          has_image: { $gt: [{ $strLenCP: { $ifNull: ['$image_path', ''] } }, 0] },
        } },
      ]),
      Artwork.countDocuments(filter),
    ]);

    res.json({ artworks, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

// GET /api/artworks/:id/image — streams the stored MongoDB data URL only
// when a card/detail view actually needs it.
async function getArtworkImage(req, res, next) {
  try {
    const artwork = await Artwork.findById(req.params.id).select('image_path').lean();
    if (!artwork?.image_path) return res.status(404).end();
    const match = /^data:([^;]+);base64,(.+)$/s.exec(artwork.image_path);
    if (!match) return res.redirect(artwork.image_path);
    res.set('Cache-Control', 'public, max-age=3600, immutable');
    res.type(match[1]).send(Buffer.from(match[2], 'base64'));
  } catch (err) {
    next(err);
  }
}

// POST /api/artworks  (auth required — artist uploads their own piece)
async function createArtwork(req, res, next) {
  try {
    const { title, description, image_path, categories, materials } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required.' });

    const artwork = await Artwork.create({
      title,
      description,
      image_path,
      categories: categories || [],
      materials: materials || [],
      artist: req.user._id,
    });

    res.status(201).json({ artwork });
  } catch (err) {
    next(err);
  }
}

// GET /api/artworks/:id
async function getArtwork(req, res, next) {
  try {
    const artwork = await Artwork.findById(req.params.id).populate('artist', 'name specializations bio');
    if (!artwork) return res.status(404).json({ message: 'Artwork not found.' });

    const exhibits = await Exhibit.find({ artworks: artwork._id }).select('name event_date');
    res.json({ artwork, exhibits });
  } catch (err) {
    next(err);
  }
}

/**
 * Loads the artwork and checks STEP 4 of the login flowchart — Admin, OR
 * the Artist who owns this piece — BEFORE any mutation happens. Runs as
 * middleware ahead of updateArtwork/deleteArtwork so an unauthorized
 * request never reaches the write itself.
 */
async function loadArtworkAndAuthorize(req, res, next) {
  try {
    const artwork = await Artwork.findById(req.params.id);
    if (!artwork) return res.status(404).json({ message: 'Artwork not found.' });

    const isOwner = String(artwork.artist) === String(req.user._id);
    const isAdmin = ['admin', 'sub_admin', 'main_admin'].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You can only manage your own artwork.' });
    }

    req.artwork = artwork;
    next();
  } catch (err) {
    next(err);
  }
}

// PUT /api/artworks/:id  (owner artist or admin only — see loadArtworkAndAuthorize)
async function updateArtwork(req, res, next) {
  try {
    const artwork = req.artwork;
    const { title, description, image_path, categories, materials } = req.body;
    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ message: 'Artwork title cannot be empty.' });
    }
    if (title !== undefined) artwork.title = title;
    if (description !== undefined) artwork.description = description;
    if (image_path !== undefined) artwork.image_path = image_path;
    if (categories !== undefined) artwork.categories = categories;
    if (materials !== undefined) artwork.materials = materials;

    await artwork.save();
    res.json({ artwork });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/artworks/:id  (owner artist or admin only — see loadArtworkAndAuthorize)
async function deleteArtwork(req, res, next) {
  try {
    const artwork = req.artwork;
    await Archive.create({ entityType: 'artwork', entityId: artwork._id, snapshot: artwork.toObject(), deletedBy: req.user._id });
    await artwork.deleteOne();
    await Exhibit.updateMany({}, { $pull: { artworks: artwork._id } });
    res.json({ message: 'Artwork removed.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listArtworks,
  getArtworkImage,
  createArtwork,
  getArtwork,
  updateArtwork,
  deleteArtwork,
  loadArtworkAndAuthorize,
};
