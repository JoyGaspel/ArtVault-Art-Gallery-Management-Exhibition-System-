const Archive = require('../models/Archive');
const mongoose = require('mongoose');
const Artist = require('../models/Artist');
const Artwork = require('../models/Artwork');
const Exhibit = require('../models/Exhibit');
const crypto = require('crypto');
const { recordAudit } = require('../utils/audit');
const supabase = require('../config/supabase');
const { sendAccountNoticeInBackground } = require('../services/accountNoticeService');
const { isArtistRecoverable } = require('../services/artistArtworkRecovery');
const { notifyArtworkRestored } = require('../services/artworkRestorationNotice');

function artistArtworkFilter(userId, now = new Date()) {
  return {
    entityType: 'artwork',
    deletedBy: userId,
    'snapshot.artist': userId,
    artistRecoverUntil: mongoose.trusted({ $gt: now }),
  };
}

async function listMyRemovedArtworks(req, res, next) {
  try {
    const archives = await Archive.find(artistArtworkFilter(req.user._id))
      .select('entityId snapshot.title snapshot.visibility snapshot.categories deletedAt artistRecoverUntil')
      .sort({ deletedAt: -1 })
      .lean();
    res.set('Cache-Control', 'no-store');
    res.json({ artworks: archives.map((item) => ({
      archiveId: item._id,
      artworkId: item.entityId,
      title: item.snapshot?.title || 'Untitled artwork',
      visibility: item.snapshot?.visibility === 'private' ? 'private' : 'public',
      categories: item.snapshot?.categories || [],
      deletedAt: item.deletedAt,
      recoverUntil: item.artistRecoverUntil,
    })) });
  } catch (err) { next(err); }
}

async function restoreMyRemovedArtwork(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Removed artwork not found.' });
    const archive = await Archive.findOne({ _id: req.params.id, ...artistArtworkFilter(req.user._id) });
    if (!archive) return res.status(404).json({ message: 'This artwork is no longer in your 30-day recovery area.' });
    if (await Artwork.exists({ _id: archive.entityId })) return res.status(409).json({ message: 'This artwork has already been restored.' });
    await Artwork.create(archive.snapshot);
    await archive.deleteOne();
    recordAudit({ req, action: 'restore', entityType: 'artwork', entityId: archive.entityId, details: { source: 'artist_recovery' } });
    await notifyArtworkRestored(archive);
    res.json({ message: 'Artwork restored.', artworkId: archive.entityId, visibility: archive.snapshot.visibility || 'public' });
  } catch (err) { next(err); }
}

async function listArchives(req, res, next) {
  try {
    const filter = req.user.role === 'main_admin' ? {} : {
      entityType: mongoose.trusted({ $ne: 'artist' }),
      'snapshot.visibility': mongoose.trusted({ $ne: 'private' }),
    };
    // Self-removed artworks stay in the artist's recovery area for 30 days.
    // A date filter moves them into this admin list without a background job.
    filter.$or = [
      { artistRecoverUntil: null },
      { artistRecoverUntil: mongoose.trusted({ $lte: new Date() }) },
    ];
    // Archive snapshots retain image data for restoration, but the archive
    // list only needs labels and timestamps. Excluding base64 image fields
    // prevents the admin page from downloading megabytes unnecessarily.
    const archives = await Archive.find(filter)
      .select('-snapshot.image_path -snapshot.avatar_path -snapshot.password')
      .sort({ deletedAt: -1 })
      .populate('deletedBy', 'name email')
      .lean();
    res.set('Cache-Control', 'no-store');
    res.json({ archives });
  } catch (err) { next(err); }
}

async function restoreArchive(req, res, next) {
  try {
    const archive = await Archive.findById(req.params.id);
    if (!archive) return res.status(404).json({ message: 'Archive item not found.' });
    if (req.user.role !== 'main_admin' && archive.entityType === 'artwork' && archive.snapshot?.visibility === 'private') return res.status(404).json({ message: 'Archive item not found.' });
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
      const restoredArtworks = [];
      for (const artworkArchive of artworkArchives) {
        if (!(await Artwork.exists({ _id: artworkArchive.entityId }))) {
          await Artwork.create(artworkArchive.snapshot);
          restoredArtworks.push(artworkArchive);
        }
        await artworkArchive.deleteOne();
      }
      await archive.deleteOne();
      for (const artworkArchive of restoredArtworks) await notifyArtworkRestored(artworkArchive);
      sendAccountNoticeInBackground(existing?.email || archive.snapshot?.email, 'active');
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
    recordAudit({ req, action: 'restore', entityType: archive.entityType, entityId: archive.entityId });
    if (archive.entityType === 'artwork') await notifyArtworkRestored(archive);
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
    if (isArtistRecoverable(result)) return res.status(409).json({ message: 'This artwork is still in the artist’s 30-day recovery period.' });
    let deletedArtistEmail = '';
    if (result.entityType === 'artist') {
      const artist = await Artist.findById(result.entityId).select('+supabaseUserId');
      deletedArtistEmail = artist?.email || result.snapshot?.email || '';
      const supabaseUserId = artist?.supabaseUserId || result.snapshot?.supabaseUserId;
      if (supabaseUserId && !supabase?.admin?.auth?.admin) return res.status(503).json({ message: 'Supabase server credentials are required to permanently delete this artist account.' });
      if (supabaseUserId) {
        const { error } = await supabase.admin.auth.admin.deleteUser(supabaseUserId);
        if (error) return res.status(502).json({ message: 'Could not permanently remove the artist authentication account.' });
      }
      await Artist.deleteOne({ _id: result.entityId });
      await Archive.deleteMany({ entityType: 'artwork', 'snapshot.artist': result.entityId });
    }
    await result.deleteOne();
    if (deletedArtistEmail) sendAccountNoticeInBackground(deletedArtistEmail, 'permanently_deleted');
    recordAudit({ req, action: 'permanent_delete', entityType: 'archive', entityId: result._id, details: { archivedEntityType: result.entityType } });
    res.json({ message: 'Archive item permanently deleted.' });
  } catch (err) { next(err); }
}

async function requestArchiveDeletion(req, res, next) {
  try {
    const archive = await Archive.findById(req.params.id);
    if (!archive) return res.status(404).json({ message: 'Archive item not found.' });
    if (req.user.role !== 'main_admin' && archive.entityType === 'artwork' && archive.snapshot?.visibility === 'private') return res.status(404).json({ message: 'Archive item not found.' });
    if (archive.entityType === 'artist') return res.status(403).json({ message: 'Suspended artist accounts are reviewed by the main administrator.' });
    const updated = await Archive.findOneAndUpdate(
      { _id: archive._id, status: mongoose.trusted({ $ne: 'pending' }) },
      { $set: { status: 'pending', deletedBy: req.user._id } },
      { new: true },
    );
    if (!updated) return res.status(409).json({ message: 'This deletion is already awaiting main-admin review.' });
    recordAudit({ req, action: 'delete_request', entityType: 'archive', entityId: archive._id, details: { archivedEntityType: archive.entityType } });
    res.json({ message: 'Deletion request sent to the main administrator.' });
  } catch (err) { next(err); }
}

module.exports = { listArchives, restoreArchive, permanentlyDeleteArchive, requestArchiveDeletion, listMyRemovedArtworks, restoreMyRemovedArtwork };
