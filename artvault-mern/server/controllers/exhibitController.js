const Exhibit = require('../models/Exhibit');
const Archive = require('../models/Archive');
const Artwork = require('../models/Artwork');

// GET /api/exhibits
async function listExhibits(req, res, next) {
  try {
    const exhibits = await Exhibit.find()
      .populate({ path: 'artworks', select: 'title image_path categories' })
      .sort({ event_date: 1 });
    res.json({ exhibits });
  } catch (err) {
    next(err);
  }
}

// GET /api/exhibits/:id
async function getExhibit(req, res, next) {
  try {
    const exhibit = await Exhibit.findById(req.params.id).populate({
      path: 'artworks',
      populate: { path: 'artist', select: 'name' },
    });
    if (!exhibit) return res.status(404).json({ message: 'Exhibit not found.' });
    res.json({ exhibit });
  } catch (err) {
    next(err);
  }
}

// POST /api/exhibits  (admin only)
async function createExhibit(req, res, next) {
  try {
    const { name, description, event_date, artworks } = req.body;
    if (!name || !event_date) {
      return res.status(400).json({ message: 'Name and event date are required.' });
    }

    let validArtworks = [];
    if (Array.isArray(artworks) && artworks.length) {
      validArtworks = await Artwork.find({ _id: { $in: artworks } }).distinct('_id');
    }

    const exhibit = await Exhibit.create({
      name,
      description,
      event_date,
      artworks: validArtworks,
    });
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
    if (name !== undefined) exhibit.name = name;
    if (description !== undefined) exhibit.description = description;
    if (event_date !== undefined) exhibit.event_date = event_date;
    if (artworks !== undefined) {
      exhibit.artworks = await Artwork.find({ _id: { $in: artworks } }).distinct('_id');
    }

    await exhibit.save();
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
    res.json({ message: 'Exhibit removed.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listExhibits, getExhibit, createExhibit, updateExhibit, deleteExhibit };
