const Exhibit = require('../models/Exhibit');
const mongoose = require('mongoose');
const Archive = require('../models/Archive');
const Artwork = require('../models/Artwork');
const Artist = require('../models/Artist');
const Notification = require('../models/Notification');
const { recordAudit } = require('../utils/audit');
const { sendNotificationEmailInBackground } = require('../services/notificationEmailService');

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function cleanArtworkIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => mongoose.isValidObjectId(id)).map((id) => String(id)))].slice(0, 100);
}

function validateExhibitFields({ name, description, event_date }) {
  const cleanName = cleanText(name, 150);
  if (!cleanName) return { error: 'Exhibit name is required.' };
  if (typeof name !== 'string' || name.trim().length > 150) return { error: 'Exhibit name must be 150 characters or fewer.' };
  if (description !== undefined && typeof description !== 'string') return { error: 'Exhibit description must be text.' };
  if (typeof description === 'string' && description.trim().length > 1000) return { error: 'Exhibit description must be 1,000 characters or fewer.' };
  if (!event_date || Number.isNaN(new Date(event_date).getTime())) return { error: 'A valid exhibit date is required.' };
  return { name: cleanName, description: cleanText(description, 1000), event_date: new Date(event_date) };
}

// GET /api/exhibits
async function listExhibits(req, res, next) {
  try {
    res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=30');
    const exhibits = await Exhibit.find()
      .populate({ path: 'artworks', select: 'title categories' })
      .sort({ event_date: 1 })
      .lean();
    exhibits.forEach((exhibit) => {
      exhibit.artworks = exhibit.artworks.map((artwork) => ({ ...artwork, has_image: true }));
    });
    res.json({ exhibits });
  } catch (err) {
    next(err);
  }
}

// GET /api/exhibits/:id
async function getExhibit(req, res, next) {
  try {
    res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=30');
    const exhibit = await Exhibit.findById(req.params.id).lean();
    if (!exhibit) return res.status(404).json({ message: 'Exhibit not found.' });
    const imageOrigin = `${req.protocol}://${req.get('host')}`;
    const artworkIds = exhibit.artworks || [];
    const artworks = artworkIds.length ? await Artwork.aggregate([
      { $match: { _id: { $in: artworkIds } } },
      { $addFields: { exhibit_order: { $indexOfArray: [artworkIds, '$_id'] } } },
      { $sort: { exhibit_order: 1 } },
      { $lookup: { from: 'artists', localField: 'artist', foreignField: '_id', as: 'artist' } },
      { $lookup: { from: 'artwork_likes', let: { artworkId: '$_id' }, pipeline: [
        { $match: { $expr: { $eq: ['$artwork', '$$artworkId'] } } },
        { $count: 'count' },
      ], as: 'like_stats' } },
      { $project: {
        title: 1, description: 1, categories: 1, materials: 1,
        created_at: 1, updated_at: 1, artist: { $arrayElemAt: ['$artist', 0] },
        like_count: { $ifNull: [{ $arrayElemAt: ['$like_stats.count', 0] }, 0] },
        has_image: { $gt: [{ $strLenCP: { $ifNull: ['$image_path', ''] } }, 0] },
        has_thumbnail: { $gt: [{ $strLenCP: { $ifNull: ['$thumbnail_path', ''] } }, 0] },
      } },
    ]) : [];
    exhibit.artworks = artworks.map((artwork) => ({
      ...artwork,
      artist: artwork.artist ? { _id: artwork.artist._id, name: artwork.artist.name } : null,
      thumbnail_url: artwork.has_image ? `${imageOrigin}/api/artworks/${artwork._id}/thumbnail?v=${encodeURIComponent(artwork.updated_at || '')}` : '',
    }));
    res.json({ exhibit });
  } catch (err) {
    next(err);
  }
}

// POST /api/exhibits  (admin only)
async function createExhibit(req, res, next) {
  try {
    const { name, description, event_date, artworks } = req.body;
    const fields = validateExhibitFields({ name, description, event_date });
    if (fields.error) return res.status(400).json({ message: fields.error });

    let validArtworks = [];
    const artworkIds = cleanArtworkIds(artworks);
    if (artworkIds.length) {
      validArtworks = await Artwork.find({ _id: mongoose.trusted({ $in: artworkIds }) }).distinct('_id');
    }

    const exhibit = await Exhibit.create({
      ...fields,
      artworks: validArtworks,
    });
    // Notify active artists in the background so creating an exhibit remains
    // fast and a notification failure cannot block the admin action.
    Artist.find({ role: 'artist', status: 'active' }).select('_id').lean()
      .then(async (artists) => {
        if (!artists.length) return;
        const eventDate = new Date(exhibit.event_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const selectedWorks = validArtworks.length
          ? await Artwork.find({ _id: mongoose.trusted({ $in: validArtworks }) }).select('_id artist title').lean()
          : [];
        const selectedByArtist = new Map();
        selectedWorks.forEach((work) => {
          const key = String(work.artist);
          if (!selectedByArtist.has(key)) selectedByArtist.set(key, []);
          selectedByArtist.get(key).push(work.title);
        });
        return Notification.insertMany(artists.map((artist) => ({
          recipient: artist._id,
          type: 'exhibit',
          title: 'New exhibit opportunity',
          message: `“${exhibit.name}” is scheduled for ${eventDate}. View the exhibit to learn more or submit your artwork.`,
          exhibit: exhibit._id,
          ...(selectedByArtist.has(String(artist._id)) ? {
            title: 'Your artwork was selected',
            message: `Your artwork${selectedByArtist.get(String(artist._id)).length > 1 ? 's' : ''} ${selectedByArtist.get(String(artist._id)).map((title) => `“${title}”`).join(', ')} ${selectedByArtist.get(String(artist._id)).length > 1 ? 'were' : 'was'} selected for “${exhibit.name}”. The exhibit is scheduled for ${eventDate}.`,
          } : {}),
        }))).then((notifications) => Promise.allSettled(notifications.map((notification) => sendNotificationEmailInBackground(notification))));
      })
      .catch((error) => console.error('Exhibit notifications could not be created:', error.message));
    recordAudit({ req, action: 'create', entityType: 'exhibit', entityId: exhibit._id, details: { name: exhibit.name } });
    res.status(201).json({ exhibit });
  } catch (err) {
    next(err);
  }
}

// PUT /api/exhibits/:id  (admin only)
async function updateExhibit(req, res, next) {
  try {
    const exhibit = await Exhibit.findById(req.params.id);
    if (!exhibit) return res.status(404).json({ message: 'Exhibit not found.' });

    const { name, description, event_date, artworks } = req.body;
    const fields = validateExhibitFields({
      name: name === undefined ? exhibit.name : name,
      description: description === undefined ? exhibit.description : description,
      event_date: event_date === undefined ? exhibit.event_date : event_date,
    });
    if (fields.error) return res.status(400).json({ message: fields.error });
    exhibit.name = fields.name;
    exhibit.description = fields.description;
    exhibit.event_date = fields.event_date;
    if (artworks !== undefined) {
      const artworkIds = cleanArtworkIds(artworks);
    exhibit.artworks = await Artwork.find({ _id: mongoose.trusted({ $in: artworkIds }) }).distinct('_id');
    }

    await exhibit.save();
    recordAudit({ req, action: 'update', entityType: 'exhibit', entityId: exhibit._id, details: { name: exhibit.name } });
    res.json({ exhibit });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/exhibits/:id  (admin only)
async function deleteExhibit(req, res, next) {
  try {
    const exhibit = await Exhibit.findById(req.params.id);
    if (!exhibit) return res.status(404).json({ message: 'Exhibit not found.' });
    await Archive.create({ entityType: 'exhibit', entityId: exhibit._id, snapshot: exhibit.toObject(), deletedBy: req.user._id });
    await exhibit.deleteOne();
    recordAudit({ req, action: 'delete', entityType: 'exhibit', entityId: exhibit._id, details: { name: exhibit.name } });
    res.json({ message: 'Exhibit removed.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listExhibits, getExhibit, createExhibit, updateExhibit, deleteExhibit };
