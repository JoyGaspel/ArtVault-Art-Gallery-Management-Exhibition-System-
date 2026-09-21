const mongoose = require('mongoose');
const SubmitExhibitEntry = require('../models/SubmitExhibitEntry');
const Exhibit = require('../models/Exhibit');
const Artwork = require('../models/Artwork');
const { recordAudit } = require('../utils/audit');

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function validId(value) {
  return mongoose.isValidObjectId(value);
}

function cutoffFor(exhibit) {
  return new Date(new Date(exhibit.event_date).getTime() - THREE_DAYS_MS);
}

function populateEntry(query) {
  return query
    .populate({ path: 'artist', select: 'name email' })
    .populate({ path: 'artwork', select: 'title description categories materials artist created_at', populate: { path: 'artist', select: 'name' } })
    .populate({ path: 'exhibit', select: 'name description event_date artworks' })
    .populate({ path: 'decided_by', select: 'name role' });
}

function addAttemptMetadata(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    if (entry.status === 'withdrawn') return;
    const key = `${entry.artist?._id || entry.artist}:${entry.artwork?._id || entry.artwork}:${entry.exhibit?._id || entry.exhibit}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  const metadata = new Map();
  groups.forEach((group) => {
    group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    group.forEach((entry, index) => metadata.set(String(entry._id), { attempt_number: index + 1, attempts_used: group.length, retries_remaining: Math.max(0, 2 - group.length) }));
  });
  return entries.map((entry) => ({ ...entry.toObject(), ...(metadata.get(String(entry._id)) || { attempt_number: null, attempts_used: 0, retries_remaining: 2 }) }));
}

// GET /api/exhibit-entries/my
async function listMyEntries(req, res, next) {
  try {
    const entries = await populateEntry(SubmitExhibitEntry.find({ artist: req.user._id }).sort({ createdAt: -1 }));
    res.json({ entries: addAttemptMetadata(entries) });
  } catch (err) { next(err); }
}

// GET /api/exhibit-entries/review (admin only)
async function listReviewEntries(req, res, next) {
  try {
    const filter = req.query.status && ['pending', 'approved', 'denied', 'withdrawn'].includes(req.query.status)
      ? { status: req.query.status } : {};
    const entries = await populateEntry(SubmitExhibitEntry.find(filter).sort({ createdAt: -1 }));
    res.json({ entries: addAttemptMetadata(entries) });
  } catch (err) { next(err); }
}

// POST /api/exhibit-entries (artist only)
async function submitEntry(req, res, next) {
  try {
    const { exhibit: exhibitId, artwork: artworkId } = req.body;
    if (!validId(exhibitId) || !validId(artworkId)) return res.status(400).json({ message: 'Choose a valid exhibit and artwork.' });

    const exhibit = await Exhibit.findById(exhibitId).select('name event_date artworks');
    if (!exhibit) return res.status(404).json({ message: 'Exhibit not found.' });
    if (new Date(exhibit.event_date) <= new Date()) return res.status(400).json({ message: 'This exhibit has already started.' });
    if (new Date() >= cutoffFor(exhibit)) return res.status(400).json({ message: 'Entries close three days before the exhibit date.' });

    const artwork = await Artwork.findOne({ _id: artworkId, artist: req.user._id }).select('title artist');
    if (!artwork) return res.status(403).json({ message: 'You can only submit your own artwork.' });

    if (exhibit.artworks.some((includedId) => String(includedId) === String(artwork._id))) {
      return res.status(409).json({ message: 'This artwork is already included in this exhibit.' });
    }

    const existingEntries = await SubmitExhibitEntry.find({ artist: req.user._id, artwork: artworkId, exhibit: exhibitId }).sort({ createdAt: 1 });
    if (existingEntries.some((entry) => entry.status === 'approved')) return res.status(409).json({ message: 'This artwork is already approved for this exhibit.' });
    if (existingEntries.some((entry) => entry.status === 'pending')) return res.status(409).json({ message: 'This artwork already has a pending submission for this exhibit.' });
    const deniedAttempts = existingEntries.filter((entry) => entry.status === 'denied').length;
    if (deniedAttempts >= 2) return res.status(409).json({ message: 'This artwork has used both submission attempts for this exhibit.' });

    const entry = await SubmitExhibitEntry.create({ artist: req.user._id, artwork: artwork._id, exhibit: exhibit._id });
    recordAudit({ req, action: 'create', entityType: 'exhibit_entry', entityId: entry._id, details: { exhibit: exhibit.name, artwork: artwork.title, status: 'pending' } });
    res.status(201).json({ entry: await populateEntry(SubmitExhibitEntry.findById(entry._id)) });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ message: 'This artwork has already been submitted to this exhibit.' });
    next(err);
  }
}

// DELETE /api/exhibit-entries/:id (artist withdraws pending entry)
async function withdrawEntry(req, res, next) {
  try {
    const entry = await SubmitExhibitEntry.findOne({ _id: req.params.id, artist: req.user._id }).populate('exhibit', 'event_date name');
    if (!entry) return res.status(404).json({ message: 'Submission not found.' });
    if (entry.status !== 'pending') return res.status(400).json({ message: 'Only pending submissions can be withdrawn.' });
    if (new Date() >= cutoffFor(entry.exhibit)) return res.status(400).json({ message: 'Withdrawals close three days before the exhibit date.' });
    entry.status = 'withdrawn';
    await entry.save();
    recordAudit({ req, action: 'update', entityType: 'exhibit_entry', entityId: entry._id, details: { status: 'withdrawn', exhibit: entry.exhibit.name } });
    res.json({ message: 'Submission withdrawn.', entry });
  } catch (err) { next(err); }
}

// PUT /api/exhibit-entries/:id/decision (admin only)
async function decideEntry(req, res, next) {
  try {
    const { status, denial_reason } = req.body;
    if (!['approved', 'denied'].includes(status)) return res.status(400).json({ message: 'Decision must be approved or denied.' });
    const reason = typeof denial_reason === 'string' ? denial_reason.trim().slice(0, 500) : '';
    if (status === 'denied' && !reason) return res.status(400).json({ message: 'A reason is required when denying a submission.' });
    const entry = await SubmitExhibitEntry.findById(req.params.id).populate('exhibit', 'name event_date');
    if (!entry) return res.status(404).json({ message: 'Submission not found.' });
    if (entry.status !== 'pending') return res.status(400).json({ message: `This submission is already ${entry.status}.` });
    entry.status = status;
    entry.denial_reason = status === 'denied' ? reason : '';
    entry.decided_at = new Date();
    entry.decided_by = req.user._id;
    await entry.save();
    if (status === 'approved') {
      // Approval is the only submission action that changes the existing
      // exhibit document, matching the original exhibit API behavior.
      await Exhibit.updateOne({ _id: entry.exhibit._id }, { $addToSet: { artworks: entry.artwork } });
    }
    recordAudit({ req, action: 'update', entityType: 'exhibit_entry', entityId: entry._id, details: { status, exhibit: entry.exhibit.name, denial_reason: reason || undefined } });
    res.json({ entry: await populateEntry(SubmitExhibitEntry.findById(entry._id)) });
  } catch (err) { next(err); }
}

module.exports = { listMyEntries, listReviewEntries, submitEntry, withdrawEntry, decideEntry };
