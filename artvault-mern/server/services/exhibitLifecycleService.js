const Exhibit = require('../models/Exhibit');
const mongoose = require('mongoose');
const Artist = require('../models/Artist');
const SubmitExhibitEntry = require('../models/SubmitExhibitEntry');
const Notification = require('../models/Notification');
const { exhibitPhase, exhibitWindow } = require('../utils/exhibitSchedule');
const { sendNotificationEmailInBackground } = require('./notificationEmailService');

let running = null;
let lastRun = 0;

async function notifyOnce({ recipient, type, title, message, exhibit, dedupe_key }) {
  try {
    const result = await Notification.updateOne(
      { recipient, dedupe_key },
      { $setOnInsert: { recipient, type, title, message, exhibit, dedupe_key } },
      { upsert: true },
    );
    if (result.upsertedCount) {
      sendNotificationEmailInBackground({ recipient, type, title, message, exhibit });
    }
  } catch (error) {
    // Another server may have inserted the same notice at the same instant.
    if (error.code !== 11000) throw error;
  }
}

async function notifyActiveArtists(exhibit, kind) {
  const artists = await Artist.find({ role: 'artist', status: 'active' }).select('_id').lean();
  const title = kind === 'start' ? 'The exhibit is happening now' : 'The exhibit has ended';
  const message = kind === 'start'
    ? `“${exhibit.name}” is now open. Explore the artworks in the exhibit.`
    : `“${exhibit.name}” has ended. You can still revisit its artworks in ArtVault.`;
  for (const artist of artists) {
    await notifyOnce({ recipient: artist._id, type: 'exhibit', title, message, exhibit: exhibit._id, dedupe_key: `exhibit:${exhibit._id}:${kind}` });
  }
}

async function expirePendingEntries(exhibit, now) {
  await SubmitExhibitEntry.updateMany({ exhibit: exhibit._id, status: 'pending' }, { $set: { status: 'expired', decided_at: now } });
  // Revisit expired entries so a process interruption between the status
  // update and notification cannot permanently lose an artist's notice.
  const expired = await SubmitExhibitEntry.find({ exhibit: exhibit._id, status: 'expired', expiry_notice_sent_at: null }).select('_id artist').lean();
  for (const entry of expired) {
    await notifyOnce({
      recipient: entry.artist,
      type: 'submission_status',
      title: 'Your exhibit submission expired',
      message: `“${exhibit.name}” ended before this submission was reviewed. Your artwork remains in your collection.`,
      exhibit: exhibit._id,
      dedupe_key: `submission:${entry._id}:expired`,
    });
    await SubmitExhibitEntry.updateOne({ _id: entry._id, status: 'expired' }, { $set: { expiry_notice_sent_at: now } });
  }
}

async function reconcileExhibitLifecycle(now = new Date()) {
  const exhibits = await Exhibit.find().select('_id name event_date starts_at ends_at lifecycle_enabled start_notification_sent_at end_notification_sent_at').lean();
  const [pending, unnotifiedExpired] = await Promise.all([
    SubmitExhibitEntry.find({ status: 'pending' }).select('exhibit').lean(),
    SubmitExhibitEntry.find({ status: 'expired', expiry_notice_sent_at: null }).select('exhibit').lean(),
  ]);
  const needsExpiryCheck = new Set([...pending, ...unnotifiedExpired].map((entry) => String(entry.exhibit)));
  for (const exhibit of exhibits) {
    const window = exhibitWindow(exhibit);
    if (!window) continue;
    const phase = exhibitPhase(exhibit, now);
    if (phase === 'past' && needsExpiryCheck.has(String(exhibit._id))) await expirePendingEntries(exhibit, now);

    let enabled = exhibit.lifecycle_enabled;
    if (!Object.prototype.hasOwnProperty.call(exhibit, 'lifecycle_enabled') && window.ends_at > now) {
      await Exhibit.updateOne({ _id: exhibit._id, lifecycle_enabled: mongoose.trusted({ $exists: false }) }, { $set: { lifecycle_enabled: true } });
      enabled = true;
    }
    if (!enabled) continue;
    if (phase === 'current' && !exhibit.start_notification_sent_at) {
      await notifyActiveArtists(exhibit, 'start');
      await Exhibit.updateOne({ _id: exhibit._id, start_notification_sent_at: null }, { $set: { start_notification_sent_at: now } });
    }
    if (phase === 'past' && !exhibit.end_notification_sent_at) {
      await notifyActiveArtists(exhibit, 'end');
      await Exhibit.updateOne({ _id: exhibit._id, end_notification_sent_at: null }, { $set: { end_notification_sent_at: now } });
    }
  }
}

function queueExhibitLifecycleCheck({ force = false } = {}) {
  if (process.env.ARTVAULT_OFFLINE === 'true') return null;
  if (running || (!force && Date.now() - lastRun < 30000)) return running;
  lastRun = Date.now();
  running = reconcileExhibitLifecycle()
    .catch((error) => console.error('Exhibit lifecycle check failed:', error))
    .finally(() => { running = null; });
  return running;
}

function startExhibitLifecycle() {
  queueExhibitLifecycleCheck({ force: true });
  const timer = setInterval(() => queueExhibitLifecycleCheck(), 60000);
  timer.unref?.();
}

module.exports = { reconcileExhibitLifecycle, queueExhibitLifecycleCheck, startExhibitLifecycle };
