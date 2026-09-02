const Archive = require('../models/Archive');
const Artist = require('../models/Artist');
const Artwork = require('../models/Artwork');
const Exhibit = require('../models/Exhibit');

async function listArchives(req, res, next) {
  try { res.json({ archives: await Archive.find().sort({ deletedAt: -1 }).populate('deletedBy', 'name email') }); } catch (err) { next(err); }
}

async function restoreArchive(req, res, next) {
  try {
    const archive = await Archive.findById(req.params.id);
    if (!archive) return res.status(404).json({ message: 'Archive item not found.' });
    const Model = { artist: Artist, artwork: Artwork, exhibit: Exhibit }[archive.entityType];
    if (await Model.exists({ _id: archive.entityId })) return res.status(409).json({ message: 'This item already exists.' });
    await Model.create(archive.snapshot);
    await archive.deleteOne();
    res.json({ message: 'Item restored successfully.' });
  } catch (err) { next(err); }
}

async function permanentlyDeleteArchive(req, res, next) {
  try {
    const result = await Archive.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Archive item not found.' });
    res.json({ message: 'Archive item permanently deleted.' });
  } catch (err) { next(err); }
}

module.exports = { listArchives, restoreArchive, permanentlyDeleteArchive };
