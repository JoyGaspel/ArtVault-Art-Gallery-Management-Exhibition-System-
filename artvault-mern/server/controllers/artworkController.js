const Artwork = require('../models/Artwork');
const Exhibit = require('../models/Exhibit');
const { archiveOnce } = require('../services/archiveService');
const ArtworkLike = require('../models/ArtworkLike');
const mongoose = require('mongoose');
const { recordAudit } = require('../utils/audit');
const { requireAuth } = require('../middleware/auth');
const { isPrivateArtwork, publicArtworkFilter, canViewArtwork } = require('../utils/artworkVisibility');
const knownMaterialTerms = new Set(require('../data/materialTerms.json'));

const ALLOWED_IMAGE_TYPES = new Map([
  ['image/png', '89504e470d0a1a0a'],
  ['image/jpeg', 'ffd8ff'],
  ['image/webp', '52494646'],
  ['image/gif', '47494638'],
]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_CATEGORIES = 5;
const MAX_MATERIALS = 20;
const ALLOWED_CATEGORIES = new Set([
  'Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography',
  'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy',
]);
// Small private thumbnails travel with the authenticated card list. This
// avoids one extra token check and HTTP request per Vault card. Larger or
// legacy images still use the protected thumbnail endpoint.
const MAX_INLINE_PRIVATE_THUMBNAIL_CHARS = 180_000;

function privateCardThumbnail() {
  return {
    $cond: [
      { $and: [
        { $eq: ['$visibility', 'private'] },
        { $gt: [{ $strLenCP: { $ifNull: ['$thumbnail_path', ''] } }, 0] },
        { $lte: [{ $strLenCP: { $ifNull: ['$thumbnail_path', ''] } }, MAX_INLINE_PRIVATE_THUMBNAIL_CHARS] },
      ] },
      '$thumbnail_path',
      '',
    ],
  };
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function cleanList(value, maxItems, maxItemLength) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, maxItemLength)).filter(Boolean))].slice(0, maxItems);
}

function invalidMaterial(value) {
  const item = value.trim();
  if (!/^[\p{L}\p{N}\s.'’()&+/-]+$/u.test(item)
    || /(?:https?:\/\/|www\.|\S+@\S+|(.)\1{4,})/iu.test(item)) return true;
  const words = item.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return !words.length || words.some((word) => !knownMaterialTerms.has(word));
}

function validateArtworkLists(categories, materials) {
  if (!Array.isArray(categories) || !categories.length || categories.length > MAX_CATEGORIES || categories.some((item) => typeof item !== 'string' || !item.trim() || item.trim().length > 40)) {
    throw Object.assign(new Error('Choose between 1 and 5 categories, each 40 characters or fewer.'), { status: 400 });
  }
  if (categories.some((item) => !ALLOWED_CATEGORIES.has(item.trim()))) {
    throw Object.assign(new Error('Choose categories from the ArtVault category list.'), { status: 400 });
  }
  if (materials !== undefined && (!Array.isArray(materials) || materials.length > MAX_MATERIALS || materials.some((item) => typeof item !== 'string' || !item.trim() || item.trim().length > 80))) {
    throw Object.assign(new Error('Use at most 20 materials, each 80 characters or fewer.'), { status: 400 });
  }
  if (materials?.some(invalidMaterial) || (materials && new Set(materials.map((item) => item.trim().toLocaleLowerCase())).size !== materials.length)) {
    throw Object.assign(new Error('Enter recognized, distinct material names (for example: canvas, acrylic paint, cotton thread). Contact an administrator if your material is missing.'), { status: 400 });
  }
}

function validateImageData(imagePath, maxBytes = MAX_IMAGE_BYTES) {
  if (!imagePath) return '';
  if (typeof imagePath !== 'string') throw Object.assign(new Error('Artwork image must be a valid file.'), { status: 400 });
  const match = /^data:([^;]+);base64,([a-z0-9+/=\s]+)$/i.exec(imagePath);
  if (!match) throw Object.assign(new Error('Only PNG, JPG/JPEG, WebP, or GIF images are allowed.'), { status: 400 });
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length || buffer.length > maxBytes) throw Object.assign(new Error(`Image must be between 1 byte and ${Math.round(maxBytes / (1024 * 1024))} MB.`), { status: 400 });
  // Detect the actual file type from its bytes. Some browsers and edited JPG
  // files report a generic or stale MIME type even though the image is valid.
  const signature = buffer.subarray(0, 12).toString('hex');
  let mime = '';
  if (signature.startsWith('89504e470d0a1a0a')) mime = 'image/png';
  else if (signature.startsWith('ffd8ff')) mime = 'image/jpeg';
  else if (signature.startsWith('52494646') && buffer.subarray(8, 12).toString('ascii') === 'WEBP') mime = 'image/webp';
  else if (signature.startsWith('474946383761') || signature.startsWith('474946383961')) mime = 'image/gif';
  if (!mime || !ALLOWED_IMAGE_TYPES.has(mime)) {
    throw Object.assign(new Error('The image file content does not match its type.'), { status: 400 });
  }
  return `data:${mime};base64,${match[2].replace(/\s/g, '')}`;
}

// GET /api/artworks?category=&artist=&page=&limit=
async function listArtworks(req, res, next) {
  try {
    // Artwork uploads should appear immediately in the deployed gallery;
    // do not let a browser/CDN serve an older list response.
    // Keep the public catalog briefly cacheable so repeat visits render
    // immediately while still reflecting uploads and edits within seconds.
    res.set('Cache-Control', 'public, no-cache, must-revalidate');
    const { category, artist } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    // Keep the public gallery responsive while still allowing management pages
    // to request a larger page explicitly.
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 24));
    const filter = publicArtworkFilter();
    if (category) filter.categories = category;
    if (artist && mongoose.isValidObjectId(artist)) filter.artist = new mongoose.Types.ObjectId(artist);

    const skip = (page - 1) * limit;

    const [artworks, total] = await Promise.all([
      Artwork.aggregate([
        { $match: filter }, { $sort: { created_at: -1 } }, { $skip: skip }, { $limit: limit },
        { $lookup: { from: 'artists', let: { artistId: '$artist' }, pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$artistId'] } } },
          { $project: { name: 1, specializations: 1 } },
        ], as: 'artist' } },
        { $lookup: { from: 'artwork_likes', let: { artworkId: '$_id' }, pipeline: [
          { $match: { $expr: { $eq: ['$artwork', '$$artworkId'] } } },
          { $count: 'count' },
        ], as: 'like_stats' } },
        { $project: {
          title: 1, description: 1, categories: 1, materials: 1, visibility: 1,
          ownershipDeclared: 1, ownershipDeclaredAt: 1,
          created_at: 1, updated_at: 1,
          artist: { $arrayElemAt: ['$artist', 0] },
          like_count: { $ifNull: [{ $arrayElemAt: ['$like_stats.count', 0] }, 0] },
          has_image: { $gt: [{ $strLenCP: { $ifNull: ['$image_path', ''] } }, 0] },
          has_thumbnail: { $gt: [{ $strLenCP: { $ifNull: ['$thumbnail_path', ''] } }, 0] },
        } },
      ]),
      Artwork.countDocuments(filter),
    ]);

    // Give clients an absolute image endpoint. This avoids relying on a
    // separately built frontend's API base URL for gallery thumbnails.
    const imageOrigin = `${req.protocol}://${req.get('host')}`;
    const artworksWithImageUrls = artworks.map((artwork) => ({
      ...artwork,
      image_url: artwork.has_image ? `${imageOrigin}/api/artworks/${artwork._id}/image?v=${encodeURIComponent(artwork.updated_at || '')}` : '',
      thumbnail_url: artwork.has_image ? `${imageOrigin}/api/artworks/${artwork._id}/thumbnail?v=${encodeURIComponent(artwork.updated_at || '')}` : '',
    }));
    res.json({ artworks: artworksWithImageUrls, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

// Private media and detail routes use this before returning any content.
// Public requests stay fast; only private artwork requires token verification.
async function authorizeArtworkRead(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Artwork not found.' });
    const artwork = await Artwork.findById(req.params.id).select('artist visibility').lean();
    if (!artwork) return res.status(404).json({ message: 'Artwork not found.' });
    if (!isPrivateArtwork(artwork)) {
      req.accessArtwork = artwork;
      return next();
    }
    if (!req.headers.authorization) return res.status(404).json({ message: 'Artwork not found.' });
    return requireAuth(req, res, () => {
      if (!canViewArtwork(artwork, req.user)) return res.status(404).json({ message: 'Artwork not found.' });
      req.accessArtwork = artwork;
      return next();
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/artworks/vault or /api/artworks/admin/vault
async function listVaultArtworks(req, res, next) {
  try {
    res.set('Cache-Control', 'private, no-store');
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 24));
    const filter = { visibility: 'private' };
    if (!['main_admin', 'sub_admin'].includes(req.user.role)) filter.artist = req.user._id;
    const [artworks, total] = await Promise.all([
      Artwork.aggregate([
        { $match: filter }, { $sort: { created_at: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
        { $lookup: { from: 'artists', localField: 'artist', foreignField: '_id', as: 'artist' } },
        { $lookup: { from: 'artwork_likes', let: { artworkId: '$_id' }, pipeline: [
          { $match: { $expr: { $eq: ['$artwork', '$$artworkId'] } } }, { $count: 'count' },
        ], as: 'like_stats' } },
        { $project: {
          title: 1, description: 1, categories: 1, materials: 1, visibility: 1,
          created_at: 1, updated_at: 1,
          artist: {
            _id: { $arrayElemAt: ['$artist._id', 0] },
            name: { $arrayElemAt: ['$artist.name', 0] },
            specializations: { $arrayElemAt: ['$artist.specializations', 0] },
          },
          like_count: { $ifNull: [{ $arrayElemAt: ['$like_stats.count', 0] }, 0] },
          has_image: { $gt: [{ $strLenCP: { $ifNull: ['$image_path', ''] } }, 0] },
          thumbnail_data: privateCardThumbnail(),
        } },
      ]),
      Artwork.countDocuments(filter),
    ]);
    // Never issue public image URLs for vaulted works. Small thumbnails are
    // included only in this authenticated, no-store response; others still
    // use the authorization-checked thumbnail endpoint.
    res.json({ artworks, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

// GET /api/artworks/mine/portfolio: owner's public and private artwork cards.
// Keep /mine public-only for the exhibit-submission picker.
async function listMyPortfolio(req, res, next) {
  try {
    res.set('Cache-Control', 'private, no-store');
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(48, Math.max(1, Number.parseInt(req.query.limit, 10) || 24));
    const visibility = ['public', 'private'].includes(req.query.visibility) ? req.query.visibility : 'all';
    const owner = req.user._id;
    const publicFilter = { artist: owner, ...publicArtworkFilter() };
    const privateFilter = { artist: owner, visibility: 'private' };
    const filter = visibility === 'private' ? privateFilter : visibility === 'public' ? publicFilter : { artist: owner };
    const [artworks, total, publicCount, privateCount] = await Promise.all([
      Artwork.aggregate([
        { $match: filter }, { $sort: { created_at: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
        { $lookup: { from: 'artwork_likes', let: { artworkId: '$_id' }, pipeline: [
          { $match: { $expr: { $eq: ['$artwork', '$$artworkId'] } } }, { $count: 'count' },
        ], as: 'like_stats' } },
        { $project: {
          title: 1, description: 1, categories: 1, visibility: { $ifNull: ['$visibility', 'public'] },
          created_at: 1, updated_at: 1,
          like_count: { $ifNull: [{ $arrayElemAt: ['$like_stats.count', 0] }, 0] },
          has_image: { $gt: [{ $strLenCP: { $ifNull: ['$image_path', ''] } }, 0] },
          thumbnail_data: privateCardThumbnail(),
        } },
      ]),
      Artwork.countDocuments(filter),
      Artwork.countDocuments(publicFilter),
      Artwork.countDocuments(privateFilter),
    ]);
    const imageOrigin = `${req.protocol}://${req.get('host')}`;
    res.json({
      artworks: artworks.map((artwork) => ({
        ...artwork,
        artist: { _id: req.user._id, name: req.user.name, specializations: req.user.specializations || [] },
        thumbnail_url: artwork.visibility === 'public' && artwork.has_image
          ? `${imageOrigin}/api/artworks/${artwork._id}/thumbnail?v=${encodeURIComponent(artwork.updated_at || '')}` : '',
      })),
      total, publicCount, privateCount, page, pages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
}

// GET /api/artworks/:id/thumbnail — optimized gallery image with legacy fallback
async function getArtworkThumbnail(req, res, next) {
  try {
    const artwork = await Artwork.findById(req.params.id).select('thumbnail_path').lean();
    let imagePath = artwork?.thumbnail_path;
    // Legacy artworks may not have a generated thumbnail. Only then read the
    // original image field, avoiding a large base64 fetch for normal requests.
    if (!imagePath) {
      const legacyArtwork = await Artwork.findById(req.params.id).select('image_path').lean();
      imagePath = legacyArtwork?.image_path;
    }
    if (!imagePath) return res.status(404).end();
    res.removeHeader('Cross-Origin-Resource-Policy');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    const match = /^data:([^;]+);base64,(.+)$/s.exec(imagePath);
    if (!match) return isPrivateArtwork(req.accessArtwork) ? res.status(404).end() : res.redirect(imagePath);
    res.set('Cache-Control', isPrivateArtwork(req.accessArtwork) ? 'private, no-store' : 'public, no-cache, must-revalidate');
    res.type(match[1]).send(Buffer.from(match[2], 'base64'));
  } catch (err) { next(err); }
}

// GET /api/artworks/mine (authenticated artist artwork picker)
async function listMyArtworks(req, res, next) {
  req.query.artist = String(req.user._id);
  return listArtworks(req, res, next);
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
    if (!match) return isPrivateArtwork(req.accessArtwork) ? res.status(404).end() : res.redirect(artwork.image_path);
    res.set('Cache-Control', isPrivateArtwork(req.accessArtwork) ? 'private, no-store' : 'public, no-cache, must-revalidate');
    res.type(match[1]).send(Buffer.from(match[2], 'base64'));
  } catch (err) {
    next(err);
  }
}

// POST /api/artworks  (auth required — artist uploads their own piece)
async function createArtwork(req, res, next) {
  try {
    const { title, description, image_path, thumbnail_path, categories, materials, visibility = 'public', ownershipDeclared } = req.body;
    if (!['public', 'private'].includes(visibility)) return res.status(400).json({ message: 'Choose Public or Save to Vault.' });
    if (visibility === 'private' && req.user.role !== 'artist') return res.status(403).json({ message: 'Only artists can save artworks to a vault.' });
    if (ownershipDeclared !== true) return res.status(400).json({ message: 'Confirm that you created this artwork or have permission to display it on ArtVault.' });
    const cleanTitle = cleanText(title, 150);
    if (!cleanTitle) return res.status(400).json({ message: 'Title is required.' });
    if (typeof title !== 'string' || title.trim().length > 50) return res.status(400).json({ message: 'Title must be 50 characters or fewer.' });
    const cleanDescription = cleanText(description, 1000);
    if (typeof description === 'string' && description.trim().length > 1000) return res.status(400).json({ message: 'Description must be 1,000 characters or fewer.' });
    if (typeof description !== 'undefined' && typeof description !== 'string') return res.status(400).json({ message: 'Description must be text.' });
    validateArtworkLists(categories, materials);

    const artwork = await Artwork.create({
      title: cleanTitle,
      description: cleanDescription,
      image_path: validateImageData(image_path),
      thumbnail_path: thumbnail_path ? validateImageData(thumbnail_path, 2 * 1024 * 1024) : '',
      categories: cleanList(categories, MAX_CATEGORIES, 40),
      materials: cleanList(materials, MAX_MATERIALS, 80),
      artist: req.user._id,
      visibility,
      ownershipDeclared: true,
      ownershipDeclaredAt: new Date(),
    });
    recordAudit({ req, action: 'create', entityType: 'artwork', entityId: artwork._id, details: visibility === 'private' ? { visibility } : { title: artwork.title } });

    res.status(201).json({ artwork });
  } catch (err) {
    next(err);
  }
}

// GET /api/artworks/:id
async function getArtwork(req, res, next) {
  try {
    res.set('Cache-Control', isPrivateArtwork(req.accessArtwork) ? 'private, no-store' : 'public, no-cache, must-revalidate');
    const [artworkRows] = await Artwork.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
      { $lookup: { from: 'artists', let: { artistId: '$artist' }, pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$artistId'] } } },
        { $project: { name: 1, specializations: 1, bio: 1 } },
      ], as: 'artist' } },
      { $lookup: { from: 'artwork_likes', let: { artworkId: '$_id' }, pipeline: [
        { $match: { $expr: { $eq: ['$artwork', '$$artworkId'] } } },
        { $count: 'count' },
      ], as: 'like_stats' } },
      { $project: {
        title: 1, description: 1, categories: 1, materials: 1, visibility: 1,
        created_at: 1, updated_at: 1,
        artist: { $arrayElemAt: ['$artist', 0] },
        like_count: { $ifNull: [{ $arrayElemAt: ['$like_stats.count', 0] }, 0] },
        has_image: { $gt: [{ $strLenCP: { $ifNull: ['$image_path', ''] } }, 0] },
        has_thumbnail: { $gt: [{ $strLenCP: { $ifNull: ['$thumbnail_path', ''] } }, 0] },
      } },
    ]);
    if (!artworkRows) return res.status(404).json({ message: 'Artwork not found.' });

    const exhibits = await Exhibit.find({ artworks: artworkRows._id }).select('name event_date');
    const imageOrigin = `${req.protocol}://${req.get('host')}`;
    res.json({
      artwork: {
        ...artworkRows,
        artist: artworkRows.artist ? { _id: artworkRows.artist._id, name: artworkRows.artist.name, specializations: artworkRows.artist.specializations || [], bio: artworkRows.artist.bio || '' } : null,
        image_url: artworkRows.has_image && !isPrivateArtwork(artworkRows) ? `${imageOrigin}/api/artworks/${artworkRows._id}/image?v=${encodeURIComponent(artworkRows.updated_at || '')}` : '',
        thumbnail_url: artworkRows.has_image && !isPrivateArtwork(artworkRows) ? `${imageOrigin}/api/artworks/${artworkRows._id}/thumbnail?v=${encodeURIComponent(artworkRows.updated_at || '')}` : '',
      },
      exhibits,
    });
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
    if (isPrivateArtwork(artwork) && req.user.role === 'sub_admin') {
      return res.status(403).json({ message: 'Sub-admins can only view Artist Vaults.' });
    }
    if ((!isOwner && !isAdmin) || (isPrivateArtwork(artwork) && !isOwner && req.user.role !== 'main_admin')) {
      return res.status(403).json({ message: 'You can only manage your own artwork.' });
    }

    req.artwork = artwork;
    next();
  } catch (err) {
    next(err);
  }
}

// Only the artist who owns a work can change its visibility.
async function setArtworkVisibility(req, res, next) {
  try {
    if (req.user.role === 'sub_admin') return res.status(403).json({ message: 'Sub-admins can only view Artist Vaults.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Artwork not found.' });
    const { visibility } = req.body;
    if (!['public', 'private'].includes(visibility)) return res.status(400).json({ message: 'Choose Public or Save to Vault.' });
    const artwork = await Artwork.findOne({ _id: req.params.id, artist: req.user._id });
    if (!artwork) return res.status(404).json({ message: 'Artwork not found.' });
    const storedImage = /^data:image\/(?:png|jpeg|webp|gif);base64,/i;
    if (visibility === 'private' && ((artwork.image_path && !storedImage.test(artwork.image_path)) || (artwork.thumbnail_path && !storedImage.test(artwork.thumbnail_path)))) {
      return res.status(409).json({ message: 'This older artwork uses an external image URL. Re-upload its image before moving it to the Vault.' });
    }
    if ((artwork.visibility || 'public') !== visibility) {
      artwork.visibility = visibility;
      await artwork.save();
      recordAudit({ req, action: 'update', entityType: 'artwork', entityId: artwork._id, details: { visibility } });
    }
    res.set('Cache-Control', 'private, no-store');
    res.json({ artwork: { _id: artwork._id, visibility: artwork.visibility, updated_at: artwork.updated_at } });
  } catch (err) { next(err); }
}

// PUT /api/artworks/:id  (owner artist or admin only — see loadArtworkAndAuthorize)
async function updateArtwork(req, res, next) {
  try {
    const artwork = req.artwork;
    const { title, description, image_path, thumbnail_path, categories, materials } = req.body;
    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({ message: 'Artwork title cannot be empty.' });
    }
    if (title !== undefined && title.trim().length > 50) return res.status(400).json({ message: 'Title must be 50 characters or fewer.' });
    if (description !== undefined && typeof description !== 'string') return res.status(400).json({ message: 'Description must be text.' });
    if (typeof description === 'string' && description.trim().length > 1000) return res.status(400).json({ message: 'Description must be 1,000 characters or fewer.' });
    if (categories !== undefined || materials !== undefined) validateArtworkLists(categories ?? artwork.categories, materials);
    if (title !== undefined) artwork.title = cleanText(title, 50);
    if (description !== undefined) artwork.description = cleanText(description, 1000);
    if (image_path !== undefined) artwork.image_path = validateImageData(image_path);
    if (thumbnail_path !== undefined) artwork.thumbnail_path = thumbnail_path ? validateImageData(thumbnail_path, 2 * 1024 * 1024) : '';
    if (categories !== undefined) artwork.categories = cleanList(categories, MAX_CATEGORIES, 40);
    if (materials !== undefined) artwork.materials = cleanList(materials, MAX_MATERIALS, 80);

    await artwork.save();
    recordAudit({ req, action: 'update', entityType: 'artwork', entityId: artwork._id, details: isPrivateArtwork(artwork) ? { visibility: 'private' } : { title: artwork.title } });
    res.json({ artwork });
  } catch (err) {
    next(err);
  }
}

// Apply an offline metadata draft only if this artist still owns the public
// artwork and the live record has not changed since the local snapshot.
async function syncArtworkMetadata(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Artwork not found.' });
    const { expectedUpdatedAt, title, description, categories, materials } = req.body || {};
    const expected = new Date(expectedUpdatedAt);
    if (!expectedUpdatedAt || Number.isNaN(expected.getTime())) {
      return res.status(400).json({ message: 'A valid snapshot version is required.' });
    }
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 50) {
      return res.status(400).json({ message: 'Title must be between 1 and 50 characters.' });
    }
    if (typeof description !== 'string' || description.trim().length > 1000) {
      return res.status(400).json({ message: 'Description must be 1,000 characters or fewer.' });
    }
    validateArtworkLists(categories, materials);
    const filter = {
      _id: req.params.id,
      artist: req.user._id,
      visibility: mongoose.trusted({ $ne: 'private' }),
      updated_at: expected,
    };
    const artwork = await Artwork.findOneAndUpdate(filter, { $set: {
      title: cleanText(title, 50),
      description: cleanText(description, 1000),
      categories: cleanList(categories, MAX_CATEGORIES, 40),
      materials: cleanList(materials, MAX_MATERIALS, 80),
    } }, { new: true, runValidators: true });
    if (!artwork) {
      const current = await Artwork.findById(req.params.id).select('artist visibility title description categories materials updated_at').lean();
      if (!current || String(current.artist) !== String(req.user._id)) return res.status(404).json({ message: 'Artwork not found in your account.' });
      if (current.visibility === 'private') return res.status(409).json({ message: 'This artwork is now in your Vault. Offline drafts cannot change Vault artworks.' });
      return res.status(409).json({ message: 'This artwork changed online. Review both versions before syncing.', current: {
        title: current.title,
        description: current.description,
        categories: current.categories,
        materials: current.materials,
        updated_at: current.updated_at,
      } });
    }
    recordAudit({ req, action: 'update', entityType: 'artwork', entityId: artwork._id, details: { title: artwork.title, source: 'offline-sync' } });
    res.set('Cache-Control', 'private, no-store');
    return res.json({ artwork: { _id: artwork._id, title: artwork.title, updated_at: artwork.updated_at } });
  } catch (err) { return next(err); }
}

// DELETE /api/artworks/:id  (owner artist or admin only — see loadArtworkAndAuthorize)
async function deleteArtwork(req, res, next) {
  try {
    const artwork = req.artwork;
    await archiveOnce({ entityType: 'artwork', snapshot: artwork.toObject(), deletedBy: req.user._id });
    await artwork.deleteOne();
    await ArtworkLike.deleteMany({ artwork: artwork._id });
    await Exhibit.updateMany({}, { $pull: { artworks: artwork._id } });
    recordAudit({ req, action: 'delete', entityType: 'artwork', entityId: artwork._id, details: isPrivateArtwork(artwork) ? { visibility: 'private' } : { title: artwork.title } });
    res.json({ message: 'Artwork removed.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listArtworks,
  listMyArtworks,
  listVaultArtworks,
  listMyPortfolio,
  authorizeArtworkRead,
  setArtworkVisibility,
  getArtworkImage,
  getArtworkThumbnail,
  createArtwork,
  getArtwork,
  updateArtwork,
  syncArtworkMetadata,
  deleteArtwork,
  loadArtworkAndAuthorize,
};
