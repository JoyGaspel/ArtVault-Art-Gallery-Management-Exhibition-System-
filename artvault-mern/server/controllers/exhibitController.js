const Exhibit = require('../models/Exhibit');
const mongoose = require('mongoose');
const Archive = require('../models/Archive');
const Artwork = require('../models/Artwork');
const { recordAudit } = require('../utils/audit');

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
    res.set('Cache-Control', 'no-store');
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
    res.set('Cache-Control', 'no-store');
    const exhibit = await Exhibit.findById(req.params.id).populate({
      path: 'artworks',
      select: '-image_path',
      populate: { path: 'artist', select: 'name' },
    }).lean();
    if (!exhibit) return res.status(404).json({ message: 'Exhibit not found.' });
    exhibit.artworks = exhibit.artworks.map((artwork) => ({ ...artwork, has_image: true }));
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
