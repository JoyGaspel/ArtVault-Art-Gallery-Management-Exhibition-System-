const Archive = require('../models/Archive');
const mongoose = require('mongoose');
const Artist = require('../models/Artist');
const Artwork = require('../models/Artwork');
const Exhibit = require('../models/Exhibit');
const crypto = require('crypto');
const { recordAudit } = require('../utils/audit');
const supabase = require('../config/supabase');

async function listArchives(req, res, next) {
  try {
    const filter = req.user.role === 'main_admin' ? {} : { entityType: mongoose.trusted({ $ne: 'artist' }) };
    res.json({ archives: await Archive.find(filter).sort({ deletedAt: -1 }).populate('deletedBy', 'name email') });
  } catch (err) { next(err); }
}

async function restoreArchive(req, res, next) {
  try {
    const archive = await Archive.findById(req.params.id);
    if (!archive) return res.status(404).json({ message: 'Archive item not found.' });
    if (archive.entityType === 'artist' && req.user.role !== 'main_admin') {
      return res.status(403).json({ message: 'Only the main administrator can review suspended artist accounts.' });
    }
    const Model = { artist: Artist, artwork: Artwork, exhibit: Exhibit }[archive.entityType];
    if (archive.entityType === 'artist') {
      const existing = await Artist.findById(archive.entityId).select('+supabaseUserId');
      if (existing && existing.status !== 'suspended') return res.status(409).json({ message: 'This artist account is already active.' });
      if (existing) {
        existing.status = 'active';
        existing.suspendedAt = null;
        await existing.save();
      } else {
        const snapshot = { ...archive.snapshot };
        if (!snapshot.password) snapshot.password = crypto.randomBytes(32).toString('hex');
        snapshot.status = 'active';
        snapshot.suspendedAt = null;
        await Artist.create(snapshot);
      }
      const artworkArchives = await Archive.find({ entityType: 'artwork', 'snapshot.artist': archive.entityId });
      for (const artworkArchive of artworkArchives) {
        if (!(await Artwork.exists({ _id: artworkArchive.entityId }))) await Artwork.create(artworkArchive.snapshot);
        await artworkArchive.deleteOne();
      }
      await archive.deleteOne();
      recordAudit({ req, action: 'restore', entityType: 'artist', entityId: archive.entityId });
      return res.json({ message: 'Artist account and artworks restored successfully.' });
    }
    if (!Model) return res.status(400).json({ message: 'Unsupported archive type.' });
    if (await Model.exists({ _id: archive.entityId })) return res.status(409).json({ message: 'This item already exists.' });
    const snapshot = { ...archive.snapshot };
    // Artist passwords are never included in archive snapshots. Generate an
    // unusable random legacy value so the required schema field is satisfied;
    // Supabase remains the authentication source for restored accounts.
    if (archive.entityType === 'artist' && !snapshot.password) {
      snapshot.password = crypto.randomBytes(32).toString('hex');
    }
    await Model.create(snapshot);
    await archive.deleteOne();
    res.json({ message: 'Item restored successfully.' });
  } catch (err) { next(err); }
}

async function permanentlyDeleteArchive(req, res, next) {
  try {
    if (req.user.role !== 'main_admin') {
      // Sub-admins may request removal, but only the main administrator may
      // permanently erase an archive record.
      return res.status(403).json({ message: 'Only the main administrator can permanently delete archive records.' });
    }
    const result = await Archive.findById(req.params.id);
    if (!result) return res.status(404).json({ message: 'Archive item not found.' });
    if (result.entityType === 'artist') {
      const artist = await Artist.findById(result.entityId).select('+supabaseUserId');
      if (artist?.supabaseUserId && !supabase?.admin) return res.status(503).json({ message: 'Supabase server credentials are required to permanently delete this artist account.' });
      if (artist?.supabaseUserId) {
        const { error } = await supabase.admin.auth.admin.deleteUser(artist.supabaseUserId);
        if (error) return res.status(502).json({ message: 'Could not permanently remove the artist authentication account.' });
      }
      await Artist.deleteOne({ _id: result.entityId });
      await Archive.deleteMany({ entityType: 'artwork', 'snapshot.artist': result.entityId });
    }
    await result.deleteOne();
    recordAudit({ req, action: 'permanent_delete', entityType: 'archive', entityId: result._id, details: { archivedEntityType: result.entityType } });
    res.json({ message: 'Archive item permanently deleted.' });
  } catch (err) { next(err); }
}

async function requestArchiveDeletion(req, res, next) {
  try {
    const archive = await Archive.findById(req.params.id);
    if (!archive) return res.status(404).json({ message: 'Archive item not found.' });
    if (archive.entityType === 'artist') return res.status(403).json({ message: 'Suspended artist accounts are reviewed by the main administrator.' });
    if (archive.status === 'pending') return res.status(409).json({ message: 'This deletion is already awaiting main-admin review.' });
    archive.status = 'pending';
    archive.deletedBy = req.user._id;
    await archive.save();
    recordAudit({ req, action: 'delete_request', entityType: 'archive', entityId: archive._id, details: { archivedEntityType: archive.entityType } });
    res.json({ message: 'Deletion request sent to the main administrator.' });
  } catch (err) { next(err); }
}

module.exports = { listArchives, restoreArchive, permanentlyDeleteArchive, requestArchiveDeletion };
