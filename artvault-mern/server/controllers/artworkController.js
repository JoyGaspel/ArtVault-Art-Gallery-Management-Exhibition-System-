const Artwork = require('../models/Artwork');
const Exhibit = require('../models/Exhibit');
const Archive = require('../models/Archive');
const mongoose = require('mongoose');
const { recordAudit } = require('../utils/audit');

const ALLOWED_IMAGE_TYPES = new Map([
  ['image/png', '89504e470d0a1a0a'],
  ['image/jpeg', 'ffd8ff'],
  ['image/webp', '52494646'],
  ['image/gif', '47494638'],
]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_CATEGORIES = 5;
const MAX_MATERIALS = 20;

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function cleanList(value, maxItems, maxItemLength) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, maxItemLength)).filter(Boolean))].slice(0, maxItems);
}

function validateImageData(imagePath) {
  if (!imagePath) return '';
  if (typeof imagePath !== 'string') throw Object.assign(new Error('Artwork image must be a valid file.'), { status: 400 });
  const match = /^data:([^;]+);base64,([a-z0-9+/=\s]+)$/i.exec(imagePath);
  if (!match) throw Object.assign(new Error('Only PNG, JPG/JPEG, WebP, or GIF images are allowed.'), { status: 400 });
  const mime = match[1].toLowerCase();
  const expected = ALLOWED_IMAGE_TYPES.get(mime);
  if (!expected) throw Object.assign(new Error('Only PNG, JPG/JPEG, WebP, or GIF images are allowed.'), { status: 400 });
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw Object.assign(new Error('Image must be between 1 byte and 10 MB.'), { status: 400 });
  const signature = buffer.subarray(0, expected.length).toString('hex');
  if (mime === 'image/webp') {
    if (signature !== expected || buffer.subarray(8, 12).toString('ascii') !== 'WEBP') throw Object.assign(new Error('The image file is invalid.'), { status: 400 });
  } else if (signature !== expected && !(mime === 'image/gif' && ['474946383761', '474946383961'].includes(buffer.subarray(0, 6).toString('hex')))) {
    throw Object.assign(new Error('The image file content does not match its type.'), { status: 400 });
  }
  return `data:${mime};base64,${match[2].replace(/\s/g, '')}`;
}

// GET /api/artworks?category=&artist=&page=&limit=
async function listArtworks(req, res, next) {
  try {
    // Artwork uploads should appear immediately in the deployed gallery;
    // do not let a browser/CDN serve an older list response.
    res.set('Cache-Control', 'no-store');
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
            { $project: { name: 1, avatar_path: 1, specializations: 1 } },
          ],
          as: 'artist',
        } },
        { $project: {
          title: 1, description: 1, categories: 1, materials: 1,
          created_at: 1, updated_at: 1,
          image_path: 1,
          artist: { $arrayElemAt: ['$artist', 0] },
          // Do not send multi-megabyte base64 data in every gallery response.
          has_image: { $gt: [{ $strLenCP: { $ifNull: ['$image_path', ''] } }, 0] },
        } },
      ]),
      Artwork.countDocuments(filter),
    ]);

    // Give clients an absolute image endpoint. This avoids relying on a
    // separately built frontend's API base URL for gallery thumbnails.
    const imageOrigin = `${req.protocol}://${req.get('host')}`;
    const artworksWithImageUrls = artworks.map((artwork) => ({
      ...artwork,
      image_url: artwork.has_image
        ? `${imageOrigin}/api/artworks/${artwork._id}/image`
        : '',
    }));
    res.json({ artworks: artworksWithImageUrls, total, page, pages: Math.ceil(total / limit) });
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
    // Helmet sets CORP=same-origin globally. Remove and replace it only for
    // this public image response so the Vercel gallery can display it.
    res.removeHeader('Cross-Origin-Resource-Policy');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
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
    const cleanTitle = cleanText(title, 150);
    if (!cleanTitle) return res.status(400).json({ message: 'Title is required.' });
    if (typeof title !== 'string' || title.trim().length > 50) return res.status(400).json({ message: 'Title must be 50 characters or fewer.' });
    const cleanDescription = cleanText(description, 1000);
    if (typeof description === 'string' && description.trim().length > 1000) return res.status(400).json({ message: 'Description must be 1,000 characters or fewer.' });
    if (typeof description !== 'undefined' && typeof description !== 'string') return res.status(400).json({ message: 'Description must be text.' });

    const artwork = await Artwork.create({
      title: cleanTitle,
      description: cleanDescription,
      image_path: validateImageData(image_path),
      categories: cleanList(categories, MAX_CATEGORIES, 40),
      materials: cleanList(materials, MAX_MATERIALS, 80),
      artist: req.user._id,
    });
    recordAudit({ req, action: 'create', entityType: 'artwork', entityId: artwork._id, details: { title: artwork.title } });

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
    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({ message: 'Artwork title cannot be empty.' });
    }
    if (title !== undefined && title.trim().length > 50) return res.status(400).json({ message: 'Title must be 50 characters or fewer.' });
    if (description !== undefined && typeof description !== 'string') return res.status(400).json({ message: 'Description must be text.' });
    if (typeof description === 'string' && description.trim().length > 1000) return res.status(400).json({ message: 'Description must be 1,000 characters or fewer.' });
    if (title !== undefined) artwork.title = cleanText(title, 50);
    if (description !== undefined) artwork.description = cleanText(description, 1000);
    if (image_path !== undefined) artwork.image_path = validateImageData(image_path);
    if (categories !== undefined) artwork.categories = cleanList(categories, MAX_CATEGORIES, 40);
    if (materials !== undefined) artwork.materials = cleanList(materials, MAX_MATERIALS, 80);

    await artwork.save();
    recordAudit({ req, action: 'update', entityType: 'artwork', entityId: artwork._id, details: { title: artwork.title } });
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
    recordAudit({ req, action: 'delete', entityType: 'artwork', entityId: artwork._id, details: { title: artwork.title } });
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
