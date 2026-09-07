const Artist = require('../models/Artist');
const Artwork = require('../models/Artwork');
const Exhibit = require('../models/Exhibit');
const Archive = require('../models/Archive');
const supabase = require('../config/supabase');
const { ALL_SPECIALIZATIONS } = require('../models/Artist');

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
  if (buffer.subarray(0, signatures[match[1].toLowerCase()].length).toString('hex') !== signatures[match[1].toLowerCase()]) throw Object.assign(new Error('The profile picture file is invalid.'), { status: 400 });
  return `data:${match[1].toLowerCase()};base64,${match[2].replace(/\s/g, '')}`;
}

// GET /api/artists
async function listArtists(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    const { specialization } = req.query;
    const filter = { role: 'artist' };
    if (specialization) filter.specializations = specialization;

    const artists = await Artist.find(filter).select('name avatar_path specializations bio createdAt');
    res.json({ artists });
  } catch (err) {
    next(err);
  }
}

// GET /api/artists/:id
async function getArtist(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store');
    const artist = await Artist.findById(req.params.id).select('name avatar_path specializations bio role createdAt');
    if (!artist) return res.status(404).json({ message: 'Artist not found.' });

    const artworks = (await Artwork.find({ artist: artist._id })
      .select('-image_path')
      .sort({ created_at: -1 })
      .lean())
      .map((artwork) => ({ ...artwork, has_image: true }));
    res.json({ artist, artworks });
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
    if (bio !== undefined) {
      if (typeof bio !== 'string') return res.status(400).json({ message: 'Bio must be text.' });
      if (bio.trim().length > 50) return res.status(400).json({ message: 'Bio must be 50 characters or fewer.' });
      artist.bio = cleanProfileText(bio, 50);
    }
    if (specializations !== undefined) artist.specializations = cleanSpecializations(specializations);
    if (avatar_path !== undefined) artist.avatar_path = cleanAvatar(avatar_path);

    await artist.save();
    res.json({ artist: artist.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/artists/me — archive owned data, then remove both account copies.
async function deleteMyAccount(req, res, next) {
  try {
    if (req.user.role === 'main_admin') {
      return res.status(403).json({ message: 'The main administrator account cannot be deleted here.' });
    }
    if (!req.supabaseUserId || !supabase.admin) {
      return res.status(503).json({ message: 'Account deletion is not configured securely yet.' });
    }

    const artworks = await Artwork.find({ artist: req.user._id }).lean();
    if (artworks.length) {
      await Archive.insertMany(artworks.map((snapshot) => ({
        entityType: 'artwork', entityId: snapshot._id, snapshot, deletedBy: req.user._id,
      })));
      await Exhibit.updateMany({}, { $pull: { artworks: { $in: artworks.map((item) => item._id) } } });
      await Artwork.deleteMany({ artist: req.user._id });
    }
    await Archive.create({ entityType: 'artist', entityId: req.user._id, snapshot: req.user.toObject(), deletedBy: req.user._id });

    const { error } = await supabase.admin.auth.admin.deleteUser(req.supabaseUserId);
    if (error) return res.status(502).json({ message: 'Could not remove the authentication account. No account data was deleted.' });
    await req.user.deleteOne();
    res.json({ message: 'Your account and artwork were archived and deleted.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/artists/admin  (administrator-only account directory)
async function listAdminArtists(req, res, next) {
  try {
    const artists = await Artist.find({ role: { $in: ['artist', 'sub_admin'] } })
      .select('name email specializations bio role createdAt')
      .sort({ createdAt: -1 });
    res.json({ artists });
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
    const artist = await Artist.findOne({ _id: req.params.id, role: { $in: ['artist', 'sub_admin'] } });
    if (!artist) return res.status(404).json({ message: 'Artist account not found.' });
    artist.role = role;
    await artist.save();
    res.json({ artist: artist.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// PUT /api/artists/admin/:id  (administrator updates an artist profile)
async function updateArtistAsAdmin(req, res, next) {
  try {
    const { name, bio, specializations } = req.body;
    const artist = await Artist.findOne({ _id: req.params.id, role: { $in: ['artist', 'sub_admin'] } });
    if (!artist) return res.status(404).json({ message: 'Artist account not found.' });
    if (name !== undefined && (!name.trim() || name.trim().length > 120)) return res.status(400).json({ message: 'Artist name must be 1–120 characters.' });
    if (bio !== undefined && (typeof bio !== 'string' || bio.trim().length > 50)) return res.status(400).json({ message: 'Bio must be 50 characters or fewer.' });

    if (name !== undefined) artist.name = cleanProfileText(name, 120);
    if (bio !== undefined) artist.bio = cleanProfileText(bio, 50);
    if (specializations !== undefined) artist.specializations = cleanSpecializations(specializations);

    await artist.save();
    res.json({ artist: artist.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/artists/admin/:id  (removes the artist and their owned artwork)
async function deleteArtistAsAdmin(req, res, next) {
  try {
    const artist = await Artist.findOne({ _id: req.params.id, role: { $in: ['artist', 'sub_admin'] } });
    if (!artist) return res.status(404).json({ message: 'Artist account not found.' });

    const artworks = await Artwork.find({ artist: artist._id }).select('_id');
    const artworkIds = artworks.map((artwork) => artwork._id);
    if (artworkIds.length) {
      const artworkDocs = await Artwork.find({ _id: { $in: artworkIds } }).lean();
      await Archive.insertMany(artworkDocs.map((snapshot) => ({ entityType: 'artwork', entityId: snapshot._id, snapshot, deletedBy: req.user._id })));
      await Exhibit.updateMany({}, { $pull: { artworks: { $in: artworkIds } } });
      await Artwork.deleteMany({ _id: { $in: artworkIds } });
    }
    await Archive.create({ entityType: 'artist', entityId: artist._id, snapshot: artist.toObject(), deletedBy: req.user._id });
    await artist.deleteOne();
    res.json({ message: 'Artist account and owned artworks deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listArtists,
  getArtist,
  updateMyProfile,
  deleteMyAccount,
  listAdminArtists,
  setArtistRole,
  updateArtistAsAdmin,
  deleteArtistAsAdmin,
};
