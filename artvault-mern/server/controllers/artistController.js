const Artist = require('../models/Artist');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Artwork = require('../models/Artwork');
const Exhibit = require('../models/Exhibit');
const supabase = require('../config/supabase');
const { ALL_SPECIALIZATIONS } = require('../models/Artist');
const { recordAudit } = require('../utils/audit');
const AdminProfile = require('../models/AdminProfile');
const ArtworkLike = require('../models/ArtworkLike');
const { publicArtworkFilter } = require('../utils/artworkVisibility');
const { sendAccountNoticeInBackground } = require('../services/accountNoticeService');
const { archiveOnce } = require('../services/archiveService');
const mailer = require('../config/mailer');

const DELETE_CODE_LIFETIME_MS = 10 * 60 * 1000;
const DELETE_CODE_COOLDOWN_MS = 60 * 1000;

function hashDeleteCode(artistId, code) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required for account deletion verification.');
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${artistId}:${code}`).digest('hex');
}

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
    res.set('Cache-Control', 'public, no-cache, must-revalidate');
    const { specialization } = req.query;
    const filter = { role: 'artist' };
    if (specialization) filter.specializations = specialization;

    const artists = await Artist.aggregate([
      { $match: filter },
      { $sort: { createdAt: 1 } },
      { $lookup: {
        from: 'artworks',
        let: { artistId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$artist', '$$artistId'] } } },
          { $match: { visibility: { $ne: 'private' } } },
          { $sort: { created_at: -1 } },
          { $limit: 1 },
          { $project: { title: 1, updated_at: 1, has_image: { $gt: [{ $strLenCP: { $ifNull: ['$image_path', ''] } }, 0] } } },
        ],
        as: 'latestArtwork',
      } },
      { $lookup: {
        from: 'artworks',
        let: { artistId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$artist', '$$artistId'] } } },
          { $match: publicArtworkFilter() },
          { $count: 'count' },
        ],
        as: 'publishedArtworkStats',
      } },
      { $project: {
        name: 1, specializations: 1, bio: 1, createdAt: 1, updatedAt: 1,
        latestArtwork: { $arrayElemAt: ['$latestArtwork', 0] },
        publishedArtworkCount: { $ifNull: [{ $arrayElemAt: ['$publishedArtworkStats.count', 0] }, 0] },
        hasAvatar: { $gt: [{ $strLenCP: { $ifNull: ['$avatar_path', ''] } }, 0] },
      } },
    ]);
    const imageOrigin = `${req.protocol}://${req.get('host')}`;
    const withAvatarUrls = artists.map((artist) => ({
      ...artist,
      avatar_url: artist.hasAvatar ? `${req.protocol}://${req.get('host')}/api/artists/${artist._id}/avatar?v=${encodeURIComponent(artist.updatedAt || '')}` : '',
      latestArtwork: artist.latestArtwork ? {
        _id: artist.latestArtwork._id,
        title: artist.latestArtwork.title,
        thumbnail_url: artist.latestArtwork.has_image ? `${imageOrigin}/api/artworks/${artist.latestArtwork._id}/thumbnail?v=${encodeURIComponent(artist.latestArtwork.updated_at || '')}` : '',
      } : null,
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
    const artist = await Artist.findById(req.params.id).select('avatar_path role').lean();
    if (!artist?.avatar_path || artist.role !== 'artist') return res.status(404).end();
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
    res.set('Cache-Control', 'public, no-cache, must-revalidate');
    const artist = await Artist.findById(req.params.id).select('name avatar_path specializations bio role createdAt updatedAt');
    if (!artist || artist.role !== 'artist') return res.status(404).json({ message: 'Artist not found.' });

    const imageOrigin = `${req.protocol}://${req.get('host')}`;
    const avatarUrl = artist.avatar_path ? `${imageOrigin}/api/artists/${artist._id}/avatar?v=${encodeURIComponent(artist.updatedAt || '')}` : '';
    const artistData = artist.toObject();
    delete artistData.avatar_path;
    delete artistData.updatedAt;
    const artworks = (await Artwork.aggregate([
      { $match: { artist: artist._id, ...publicArtworkFilter() } },
      { $sort: { created_at: -1 } },
      { $lookup: { from: 'artwork_likes', let: { artworkId: '$_id' }, pipeline: [
        { $match: { $expr: { $eq: ['$artwork', '$$artworkId'] } } },
        { $count: 'count' },
      ], as: 'like_stats' } },
      { $project: {
        title: 1, description: 1, categories: 1, materials: 1,
        created_at: 1, updated_at: 1, artist: 1,
        like_count: { $ifNull: [{ $arrayElemAt: ['$like_stats.count', 0] }, 0] },
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
    if (req.user.role !== 'artist' && !req.adminSelfProfile) return res.status(403).json({ message: 'Administrator profiles cannot be edited here.' });
    const { name, firstName, lastName, bio, specializations, avatar_path, emailLikes, emailSubmissionStatus, emailExhibits, emailArtworkRestored } = req.body;
    const artist = req.user;
    const previous = {
      name: artist.name, firstName: artist.firstName, lastName: artist.lastName,
      bio: artist.bio, specializations: JSON.stringify(artist.specializations || []),
      avatar_path: artist.avatar_path, emailLikes: artist.emailLikes,
      emailSubmissionStatus: artist.emailSubmissionStatus, emailExhibits: artist.emailExhibits,
      emailArtworkRestored: artist.emailArtworkRestored,
    };

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
    if (emailLikes !== undefined) artist.emailLikes = emailLikes === true;
    if (emailSubmissionStatus !== undefined) artist.emailSubmissionStatus = emailSubmissionStatus === true;
    if (emailExhibits !== undefined) artist.emailExhibits = emailExhibits === true;
    if (emailArtworkRestored !== undefined) artist.emailArtworkRestored = emailArtworkRestored === true;

    const changedFields = ['name', 'firstName', 'lastName', 'bio', 'emailLikes', 'emailSubmissionStatus', 'emailExhibits', 'emailArtworkRestored']
      .filter((field) => previous[field] !== artist[field]);
    if (previous.specializations !== JSON.stringify(artist.specializations || [])) changedFields.push('specializations');
    if (previous.avatar_path !== artist.avatar_path) changedFields.push('profile_picture');
    if (changedFields.length) {
      await artist.save();
      await recordAudit({ req, action: 'update', entityType: 'artist', entityId: artist._id, details: { fields: changedFields } });
    }
    res.json({ artist: artist.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

async function requestDeletionCode(req, res, next) {
  try {
    if (req.user.role !== 'artist') return res.status(403).json({ message: 'Only artist accounts can request account deletion.' });
    if (!mailer.emailNotificationsEnabled()) return res.status(503).json({ message: 'Email verification is unavailable. Contact an ArtVault administrator; your account was not changed.' });
    const artist = await Artist.findById(req.user._id).select('+deleteCodeSentAt').lean();
    if (!artist) return res.status(404).json({ message: 'Account not found.' });
    if (artist.deleteCodeSentAt && Date.now() - new Date(artist.deleteCodeSentAt).getTime() < DELETE_CODE_COOLDOWN_MS) {
      return res.status(429).json({ message: 'Please wait one minute before requesting another code.' });
    }
    const code = String(crypto.randomInt(0, 100_000_000)).padStart(8, '0');
    const digest = hashDeleteCode(artist._id, code);
    await Artist.updateOne({ _id: artist._id }, { $set: {
      deleteCodeHash: digest,
      deleteCodeExpiresAt: new Date(Date.now() + DELETE_CODE_LIFETIME_MS),
      deleteCodeSentAt: new Date(),
      deleteCodeAttempts: 0,
    } });
    try {
      const result = await mailer.sendEmail({
        to: artist.email,
        subject: 'Confirm your ArtVault account deletion',
        ...require('../utils/securityEmail').securityEmail({ title: 'Confirm your account deletion', message: 'Enter this code in ArtVault only if you want to continue your account deletion request.', code,
          footer: 'If you did not request this, ignore this email and do not share the code. Your account has not been changed.' }),
      });
      if (result?.skipped) throw new Error('Email delivery disabled');
    } catch (error) {
      await Artist.updateOne({ _id: artist._id, deleteCodeHash: digest }, { $unset: { deleteCodeHash: '', deleteCodeExpiresAt: '', deleteCodeSentAt: '' } });
      return res.status(503).json({ message: 'Could not send the verification email. Your account was not changed.' });
    }
    return res.json({ message: 'A deletion confirmation code was sent to your registered email.' });
  } catch (err) { return next(err); }
}

// DELETE /api/artists/me — suspend the account and archive owned data for
// main-admin review. Authentication is intentionally retained until approval.
async function deleteMyAccount(req, res, next) {
  try {
    if (req.user.role !== 'artist') return res.status(403).json({ message: 'Administrator accounts cannot be deleted from profile settings.' });
    const code = req.body?.code;
    if (typeof code !== 'string' || !/^\d{8}$/.test(code)) return res.status(400).json({ message: 'Enter the 8-digit deletion code sent to your email.' });
    const digest = hashDeleteCode(req.user._id, code);
    const consumed = await Artist.findOneAndUpdate({
      _id: req.user._id,
      deleteCodeHash: digest,
      deleteCodeExpiresAt: { $gt: new Date() },
      deleteCodeAttempts: { $lt: 5 },
    }, { $unset: { deleteCodeHash: '', deleteCodeExpiresAt: '', deleteCodeSentAt: '' }, $set: { deleteCodeAttempts: 0 } });
    if (!consumed) {
      await Artist.updateOne({ _id: req.user._id, deleteCodeExpiresAt: { $gt: new Date() }, deleteCodeAttempts: { $lt: 5 } }, { $inc: { deleteCodeAttempts: 1 } });
      return res.status(400).json({ message: 'That deletion code is incorrect, expired, or already used. Request a new code if needed.' });
    }

    const artworks = await Artwork.find({ artist: req.user._id }).lean();
    if (artworks.length) {
      for (const snapshot of artworks) {
        await archiveOnce({ entityType: 'artwork', snapshot, deletedBy: req.user._id });
      }
      await Exhibit.updateMany({}, { $pull: { artworks: { $in: artworks.map((item) => item._id) } } });
      await ArtworkLike.deleteMany({ artwork: mongoose.trusted({ $in: artworks.map((item) => item._id) }) });
      await Artwork.deleteMany({ artist: req.user._id });
    }
    await archiveOnce({ entityType: 'artist', snapshot: req.user.toObject(), deletedBy: req.user._id });
    req.user.status = 'suspended';
    req.user.suspendedAt = new Date();
    await req.user.save();
    sendAccountNoticeInBackground(req.user.email, 'deletion_requested');
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
    const previousStatus = artist.status;
    if (previousStatus === status) return res.json({ artist: artist.toSafeObject(), message: 'Status is already up to date.' });
    artist.status = status;
    artist.suspendedAt = status === 'suspended' ? new Date() : null;
    await artist.save();
    await syncAdminProfile(artist);
    if (previousStatus !== status) sendAccountNoticeInBackground(artist.email, status);
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
    if (artist.role === role) return res.json({ artist: artist.toSafeObject(), message: 'Role is already up to date.' });
      if (req.body.confirmed !== true) return res.status(400).json({ message: 'Confirm the administrator access change before continuing.' });
      await require('../services/roleChangeVerification').consume(req.user._id, artist, role, req.body.otp);
      const previousRole = artist.role;
      const updated = await Artist.updateOne({ _id: artist._id, role: previousRole }, { $set: { role } });
      if (!updated.modifiedCount) return res.status(409).json({ message: 'This account role changed. Refresh and request a new verification code.' });
    artist.role = role;
    await syncAdminProfile(artist);
    recordAudit({ req, action: 'role_change', entityType: 'artist', entityId: artist._id, details: { role } });
      const { securityEmail } = require('../utils/securityEmail');
      require('../models/Notification').create({ recipient: artist._id, type: 'role_change',
        title: role === 'sub_admin' ? 'You are now a Sub-admin' : 'Sub-admin access revoked',
        message: role === 'sub_admin' ? 'The Main Admin promoted your account to Sub-admin. Your administration tools are now available. Your account no longer has a public artist profile.' : 'The Main Admin revoked your Sub-admin access. Your account is now an Artist account. Your existing artworks and security settings remain.',
      }).catch(() => console.error('Role-change in-app notification could not be saved.'));
      for (const email of new Set([req.user.email, artist.email])) {
        mailer.sendEmail({ to: email, subject: role === 'sub_admin' ? 'ArtVault: Sub-admin access granted' : 'ArtVault: Sub-admin access revoked', ...securityEmail({ title: role === 'sub_admin' ? 'Sub-admin access granted' : 'Sub-admin access revoked', message: `${artist.name} (${artist.email}) is now ${role === 'sub_admin' ? 'a Sub-admin. Administration tools are now available; this account no longer has a public artist profile' : 'an Artist. Sub-admin permissions have been removed; existing artworks and security settings remain'}.`, footer: 'Open ArtVault to see your updated role. If this change was unexpected, contact the Main Admin and secure your account.' }) }).catch(() => console.error('Role-change confirmation email could not be sent.'));
      }
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
    if (req.user.role !== 'main_admin' && await Artwork.exists({ artist: artist._id, visibility: 'private' })) {
      return res.status(403).json({ message: 'This artist has private Vault artworks. Only the main administrator can remove this account.' });
    }

    const removeRecords = async (session) => {
      const inSession = (query) => session ? query.session(session) : query;
      const writeOptions = session ? { session } : {};
      const artworks = await inSession(Artwork.find({ artist: artist._id }).select('_id'));
      const artworkIds = artworks.map((artwork) => artwork._id);
      if (artworkIds.length) {
        // sanitizeFilter is enabled globally. Server-owned $in filters must be
        // trusted, otherwise Mongoose casts the operator object as an ObjectId.
        const artworkFilter = { _id: mongoose.trusted({ $in: artworkIds }) };
        const artworkDocs = await inSession(Artwork.find(artworkFilter).lean());
        for (const snapshot of artworkDocs) {
          await archiveOnce({ entityType: 'artwork', snapshot, deletedBy: req.user._id, session });
        }
        await Exhibit.updateMany({}, { $pull: { artworks: { $in: artworkIds } } }, writeOptions);
        await Artwork.deleteMany(artworkFilter, writeOptions);
        await ArtworkLike.deleteMany({ artwork: mongoose.trusted({ $in: artworkIds }) }, writeOptions);
      }
      await archiveOnce({ entityType: 'artist', snapshot: artist.toObject(), deletedBy: req.user._id, session });
      // Administrator removals intentionally keep the Supabase Auth identity.
      // The MongoDB profile and owned content are archived/deleted here; the
      // authentication account can be reused or handled separately later.
      await artist.deleteOne(writeOptions);
    };

    // Atlas supports transactions, so an error must not leave the artist's
    // artworks archived and removed from exhibits while the artist remains.
    // A standalone offline MongoDB does not support transactions; the same
    // operation remains available there with idempotent artwork archives.
    const topology = mongoose.connection.client?.topology?.description?.type;
    if (topology === 'ReplicaSetWithPrimary' || topology === 'Sharded') {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(() => removeRecords(session));
      } finally {
        await session.endSession();
      }
    } else {
      await removeRecords();
    }
    sendAccountNoticeInBackground(artist.email, 'removed');
    recordAudit({ req, action: 'delete', entityType: 'artist', entityId: artist._id, details: { administered: true } });
    res.json({ message: 'Artist account and owned artworks deleted.' });
  } catch (err) {
    next(err);
  }
}

async function updateAdminSelfProfile(req, res, next) {
  const allowed = ['firstName', 'lastName', 'avatar_path'];
  if (Object.keys(req.body).some((key) => !allowed.includes(key))) return res.status(400).json({ message: 'Only your first name, last name, and profile picture can be changed here.' });
  req.adminSelfProfile = true;
  return updateMyProfile(req, res, next);
}

async function requestRoleChangeOtp(req, res, next) {
  try {
    if (req.user.role !== 'main_admin') return res.status(403).json({ message: 'Only the Main Admin can request role changes.' });
    if (!['artist', 'sub_admin'].includes(req.body.role) || !mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Choose a valid account and role.' });
    const target = await Artist.findOne({ _id: req.params.id, role: mongoose.trusted({ $in: ['artist', 'sub_admin'] }) });
    if (!target || target.role === req.body.role) return res.status(409).json({ message: 'This account is unavailable or already has that role. Refresh the list.' });
    await require('../services/roleChangeVerification').send(req.user, target, req.body.role);
    res.set('Cache-Control', 'no-store');
    res.json({ message: `Verification email sent to ${req.user.email}. Check your inbox and spam folder. No role has changed yet.` });
  } catch (error) { next(error); }
}

module.exports = {
  requestRoleChangeOtp,
  updateAdminSelfProfile,
  listArtists,
  getArtistAvatar,
  getArtist,
  updateMyProfile,
  requestDeletionCode,
  deleteMyAccount,
  listAdminArtists,
  setArtistRole,
  setArtistStatus,
  deleteArtistAsAdmin,
};
