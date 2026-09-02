const Artist = require('../models/Artist');
const Artwork = require('../models/Artwork');
const Exhibit = require('../models/Exhibit');
const Archive = require('../models/Archive');

// GET /api/artists
async function listArtists(req, res, next) {
  try {
    const { specialization } = req.query;
    const filter = { role: 'artist' };
    if (specialization) filter.specializations = specialization;

    const artists = await Artist.find(filter).select('name specializations bio createdAt');
    res.json({ artists });
  } catch (err) {
    next(err);
  }
}

// GET /api/artists/:id
async function getArtist(req, res, next) {
  try {
    const artist = await Artist.findById(req.params.id).select('name specializations bio role createdAt');
    if (!artist) return res.status(404).json({ message: 'Artist not found.' });

    const artworks = await Artwork.find({ artist: artist._id }).sort({ created_at: -1 });
    res.json({ artist, artworks });
  } catch (err) {
    next(err);
  }
}

// PUT /api/artists/me  (the signed-in artist updates their own profile)
async function updateMyProfile(req, res, next) {
  try {
    const { name, bio, specializations } = req.body;
    const artist = req.user;

    if (name !== undefined) artist.name = name;
    if (bio !== undefined) artist.bio = bio;
    if (specializations !== undefined) artist.specializations = specializations;

    await artist.save();
    res.json({ artist: artist.toSafeObject() });
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
    if (name !== undefined && !name.trim()) return res.status(400).json({ message: 'Artist name cannot be empty.' });

    if (name !== undefined) artist.name = name;
    if (bio !== undefined) artist.bio = bio;
    if (specializations !== undefined) artist.specializations = specializations;

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
  listAdminArtists,
  setArtistRole,
  updateArtistAsAdmin,
  deleteArtistAsAdmin,
};
