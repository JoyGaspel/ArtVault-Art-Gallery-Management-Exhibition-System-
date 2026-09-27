const Artist = require('../models/Artist');
const mongoose = require('mongoose');
const Artwork = require('../models/Artwork');
const Exhibit = require('../models/Exhibit');
const Archive = require('../models/Archive');
const supabase = require('../config/supabase');
const { ALL_SPECIALIZATIONS } = require('../models/Artist');
const { recordAudit } = require('../utils/audit');
const AdminProfile = require('../models/AdminProfile');

async function syncAdminProfile(artist) {
  const isAdmin = ['sub_admin', 'main_admin'].includes(artist.role);
  if (isAdmin) {
    return AdminProfile.updateOne(
      { artistId: artist._id },
      { $set: { role: artist.role, status: artist.status === 'suspended' ? 'suspended' : 'active' }, $setOnInsert: { promotedAt: new Date() } },
      { upsert: true },
    );
  }
  return AdminProfile.updateOne({ artistId: artist._id }, { $set: { status: 'inactive', role: 'sub_admin' } });
}

function cleanProfileText(value, maxLength) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function cleanSpecializations(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => ALL_SPECIALIZATIONS.includes(item)))].slice(0, 8);
}

function cleanAvatar(value) {
  if (value === undefined) return undefined;
  if (!value) return '';
  if (typeof value !== 'string') throw Object.assign(new Error('Profile picture must be an image file.'), { status: 400 });
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([a-z0-9+/=\s]+)$/i.exec(value);
  if (!match) throw Object.assign(new Error('Only PNG, JPG/JPEG, WebP, or GIF profile pictures are allowed.'), { status: 400 });
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) throw Object.assign(new Error('Profile picture must be 2 MB or smaller.'), { status: 400 });
  const signatures = { 'image/png': '89504e470d0a1a0a', 'image/jpeg': 'ffd8ff', 'image/webp': '52494646', 'image/gif': '47494638' };
  const declaredMime = match[1].toLowerCase();
  const hex = buffer.subarray(0, 12).toString('hex');
  // Some operating systems label .jpe/.jpeg files inconsistently. Sniff the
  // actual bytes and normalize the stored MIME type, while still rejecting
  // non-image documents and renamed arbitrary files.
  let actualMime = Object.entries(signatures).find(([mime, signature]) => hex.startsWith(signature))?.[0] || '';
  if (actualMime === 'image/webp' && buffer.subarray(8, 12).toString('ascii') !== 'WEBP') actualMime = '';
  if (!actualMime && declaredMime === 'image/gif' && ['474946383761', '474946383961'].some((sig) => hex.startsWith(sig))) actualMime = 'image/gif';
  if (!actualMime) throw Object.assign(new Error('The profile picture file is invalid.'), { status: 400 });
  return `data:${actualMime};base64,${match[2].replace(/\s/g, '')}`;
}

// GET /api/artists
async function listArtists(req, res, next) {
  try {
    res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=30');
    const { specialization } = req.query;
    const filter = { role: 'artist' };
    if (specialization) filter.specializations = specialization;

    const artists = await Artist.find(filter).select('name specializations bio createdAt updatedAt').lean();
    const withAvatarUrls = artists.map((artist) => ({
      ...artist,
      avatar_url: `${req.protocol}://${req.get('host')}/api/artists/${artist._id}/avatar?v=${encodeURIComponent(artist.updatedAt || '')}`,
    }));
    res.json({ artists: withAvatarUrls });
  } catch (err) {
    next(err);
  }
}

// GET /api/artists/:id/avatar — streams a profile image without sending it
// in the full artists directory response.
async function getArtistAvatar(req, res, next) {
  try {
    const artist = await Artist.findById(req.params.id).select('avatar_path').lean();
    if (!artist?.avatar_path) return res.status(404).end();
    const match = /^data:([^;]+);base64,(.+)$/s.exec(artist.avatar_path);
    if (!match) return res.redirect(artist.avatar_path);
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'public, max-age=3600, immutable');
    res.type(match[1]).send(Buffer.from(match[2], 'base64'));
  } catch (err) { next(err); }
}

// GET /api/artists/:id
async function getArtist(req, res, next) {
  try {
    res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=30');
    const artist = await Artist.findById(req.params.id).select('name avatar_path specializations bio role createdAt updatedAt');
    if (!artist) return res.status(404).json({ message: 'Artist not found.' });

    const imageOrigin = `${req.protocol}://${req.get('host')}`;
    const avatarUrl = artist.avatar_path ? `${imageOrigin}/api/artists/${artist._id}/avatar?v=${encodeURIComponent(artist.updatedAt || '')}` : '';
    const artistData = artist.toObject();
    delete artistData.avatar_path;
    delete artistData.updatedAt;
    const artworks = (await Artwork.aggregate([
      { $match: { artist: artist._id } },
      { $sort: { created_at: -1 } },
      { $project: {
        title: 1, description: 1, categories: 1, materials: 1,
        created_at: 1, updated_at: 1, artist: 1,
        has_image: { $gt: [{ $strLenCP: { $ifNull: ['$image_path', ''] } }, 0] },
        has_thumbnail: { $gt: [{ $strLenCP: { $ifNull: ['$thumbnail_path', ''] } }, 0] },
      } },
    ])).map((artwork) => ({
      ...artwork,
      thumbnail_url: artwork.has_image ? `${imageOrigin}/api/artworks/${artwork._id}/thumbnail?v=${encodeURIComponent(artwork.updated_at || '')}` : '',
    }));
    res.json({ artist: { ...artistData, avatar_url: avatarUrl }, artworks });
  } catch (err) {
    next(err);
  }
}

// PUT /api/artists/me  (the signed-in artist updates their own profile)
async function updateMyProfile(req, res, next) {
  try {
    const { name, firstName, lastName, bio, specializations, avatar_path } = req.body;
    const artist = req.user;

    if (firstName !== undefined || lastName !== undefined) {
      const nextFirst = cleanProfileText(firstName ?? artist.firstName, 50);
      const nextLast = cleanProfileText(lastName ?? artist.lastName, 50);
      if (!/^[A-Z][A-Za-z]*(?:\s[A-Z][A-Za-z]*)*$/.test(nextFirst) || nextFirst.length < 2) return res.status(400).json({ message: 'First name must start with a capital letter and contain letters only.' });
      if (!/^[A-Z][A-Za-z]*(?:\s[A-Z][A-Za-z]*)*$/.test(nextLast) || nextLast.length < 2) return res.status(400).json({ message: 'Last name must start with a capital letter and contain letters only.' });
      artist.firstName = nextFirst;
      artist.lastName = nextLast;
      artist.name = `${nextFirst} ${nextLast}${artist.extensionName ? ` ${artist.extensionName}` : ''}`;
    }

    if (name !== undefined && firstName === undefined && lastName === undefined) {
      const cleanName = cleanProfileText(name, 120);
      if (!cleanName) return res.status(400).json({ message: 'Display name cannot be empty.' });
      artist.name = cleanName;
    }
    if (bio !== undefined && artist.role === 'artist') {
      if (typeof bio !== 'string') return res.status(400).json({ message: 'Bio must be text.' });
      if (bio.trim().length > 50) return res.status(400).json({ message: 'Bio must be 50 characters or fewer.' });
      artist.bio = cleanProfileText(bio, 50);
    }
    if (specializations !== undefined && artist.role === 'artist') artist.specializations = cleanSpecializations(specializations);
    if (avatar_path !== undefined) artist.avatar_path = cleanAvatar(avatar_path);

    await artist.save();
    const changedFields = ['name', 'bio', 'specializations'];
    if (avatar_path !== undefined) changedFields.push('profile_picture');
    await recordAudit({ req, action: 'update', entityType: 'artist', entityId: artist._id, details: { fields: changedFields } });
    res.json({ artist: artist.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/artists/me — suspend the account and archive owned data for
// main-admin review. Authentication is intentionally retained until approval.
async function deleteMyAccount(req, res, next) {
  try {
    if (req.user.role !== 'artist') return res.status(403).json({ message: 'Administrator accounts cannot be deleted from profile settings.' });

    const artworks = await Artwork.find({ artist: req.user._id }).lean();
    if (artworks.length) {
      await Archive.insertMany(artworks.map((snapshot) => ({
        entityType: 'artwork', entityId: snapshot._id, snapshot, deletedBy: req.user._id,
      })));
      await Exhibit.updateMany({}, { $pull: { artworks: { $in: artworks.map((item) => item._id) } } });
      await Artwork.deleteMany({ artist: req.user._id });
    }
    await Archive.create({ entityType: 'artist', entityId: req.user._id, snapshot: req.user.toObject(), deletedBy: req.user._id });
    req.user.status = 'suspended';
    req.user.suspendedAt = new Date();
    await req.user.save();
    recordAudit({ req, action: 'account_delete', entityType: 'artist', entityId: req.user._id, details: { suspended: true } });
    res.json({ message: 'Your account is suspended and awaiting main-administrator review.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/artists/admin  (administrator-only account directory)
async function listAdminArtists(req, res, next) {
  try {
    const artists = await Artist.find({ role: mongoose.trusted({ $in: ['artist', 'sub_admin'] }) })
      .select('name email specializations bio avatar_path role status createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();
    const imageOrigin = `${req.protocol}://${req.get('host')}`;
    const safeArtists = artists.map((artist) => {
      const hasAvatar = Boolean(artist.avatar_path);
      delete artist.avatar_path;
      return {
        ...artist,
        avatar_url: hasAvatar ? `${imageOrigin}/api/artists/${artist._id}/avatar?v=${encodeURIComponent(artist.updatedAt || '')}` : '',
      };
    });
    res.json({ artists: safeArtists });
  } catch (err) {
    next(err);
  }
}

// PUT /api/artists/admin/:id/status (administrator account access control)
async function setArtistStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Status must be active or suspended.' });
    }
    const artist = await Artist.findOne({ _id: req.params.id, role: mongoose.trusted({ $in: ['artist', 'sub_admin'] }) });
    if (!artist) return res.status(404).json({ message: 'Artist account not found.' });
    if (artist._id.equals(req.user._id)) return res.status(400).json({ message: 'You cannot suspend your own administrator account.' });
    if (req.user.role === 'sub_admin' && artist.role !== 'artist') {
      return res.status(403).json({ message: 'Sub-admins can only suspend or activate artist accounts.' });
    }
    artist.status = status;
    artist.suspendedAt = status === 'suspended' ? new Date() : null;
    await artist.save();
    await syncAdminProfile(artist);
    recordAudit({ req, action: 'update', entityType: 'artist', entityId: artist._id, details: { status, administered: true } });
    res.json({ artist: artist.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// PUT /api/artists/admin/:id/role (main administrator only)
async function setArtistRole(req, res, next) {
  try {
    if (req.user.role !== 'main_admin') {
      return res.status(403).json({ message: 'Only the main administrator can change administrator roles.' });
    }
    const { role } = req.body;
    if (!['artist', 'sub_admin'].includes(role)) {
      return res.status(400).json({ message: 'Role must be artist or sub_admin.' });
    }
    const artist = await Artist.findOne({ _id: req.params.id, role: mongoose.trusted({ $in: ['artist', 'sub_admin'] }) }).select('+supabaseUserId');
    if (!artist) return res.status(404).json({ message: 'Artist account not found.' });
    artist.role = role;
    await artist.save();
    await syncAdminProfile(artist);
    recordAudit({ req, action: 'role_change', entityType: 'artist', entityId: artist._id, details: { role } });
    res.json({ artist: artist.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// PUT /api/artists/admin/:id  (administrator updates an artist profile)
async function updateArtistAsAdmin(req, res, next) {
  try {
    const { name, bio, specializations } = req.body;
    const artist = await Artist.findOne({ _id: req.params.id, role: mongoose.trusted({ $in: ['artist', 'sub_admin'] }) }).select('+supabaseUserId');
    if (!artist) return res.status(404).json({ message: 'Artist account not found.' });
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 120)) return res.status(400).json({ message: 'Artist name must be 1–120 characters.' });
    if (bio !== undefined && (typeof bio !== 'string' || bio.trim().length > 50)) return res.status(400).json({ message: 'Bio must be 50 characters or fewer.' });

    if (name !== undefined) artist.name = cleanProfileText(name, 120);
    if (bio !== undefined) artist.bio = cleanProfileText(bio, 50);
    if (specializations !== undefined) artist.specializations = cleanSpecializations(specializations);

    await artist.save();
    recordAudit({ req, action: 'update', entityType: 'artist', entityId: artist._id, details: { fields: ['profile'], administered: true } });
    res.json({ artist: artist.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/artists/admin/:id  (removes the artist and their owned artwork)
async function deleteArtistAsAdmin(req, res, next) {
  try {
    const artist = await Artist.findOne({ _id: req.params.id, role: mongoose.trusted({ $in: ['artist', 'sub_admin'] }) }).select('+supabaseUserId');
    if (!artist) return res.status(404).json({ message: 'Artist account not found.' });

    const artworks = await Artwork.find({ artist: artist._id }).select('_id');
    const artworkIds = artworks.map((artwork) => artwork._id);
    if (artworkIds.length) {
      const artworkDocs = await Artwork.find({ _id: mongoose.trusted({ $in: artworkIds }) }).lean();
      await Archive.insertMany(artworkDocs.map((snapshot) => ({ entityType: 'artwork', entityId: snapshot._id, snapshot, deletedBy: req.user._id })));
      await Exhibit.updateMany({}, { $pull: { artworks: { $in: artworkIds } } });
      await Artwork.deleteMany({ _id: { $in: artworkIds } });
    }
    await Archive.create({ entityType: 'artist', entityId: artist._id, snapshot: artist.toObject(), deletedBy: req.user._id });
    // Administrator removals intentionally keep the Supabase Auth identity.
    // The MongoDB profile and owned content are archived/deleted here; the
    // authentication account can be reused or handled separately later.
    await artist.deleteOne();
    recordAudit({ req, action: 'delete', entityType: 'artist', entityId: artist._id, details: { administered: true } });
    res.json({ message: 'Artist account and owned artworks deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listArtists,
  getArtistAvatar,
  getArtist,
  updateMyProfile,
  deleteMyAccount,
  listAdminArtists,
  setArtistRole,
  setArtistStatus,
  updateArtistAsAdmin,
  deleteArtistAsAdmin,
};
