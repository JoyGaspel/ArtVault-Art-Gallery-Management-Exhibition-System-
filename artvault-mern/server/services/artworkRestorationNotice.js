const Notification = require('../models/Notification');
const { sendNotificationEmailInBackground } = require('./notificationEmailService');

function restorationMessage(archive, restoredAt = new Date()) {
  const title = archive.snapshot?.title || 'Untitled artwork';
  const isPrivate = archive.snapshot?.visibility === 'private';
  const destination = isPrivate ? 'your Vault' : 'the public gallery';
  const date = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
  }).format(restoredAt);
  return `“${title}” was restored on ${date} to ${destination}. You can find it in My artworks. Previous exhibit placements and likes were not restored.`;
}

async function notifyArtworkRestored(archive) {
  try {
    const notification = await Notification.create({
      recipient: archive.snapshot.artist,
      type: 'artwork_restored',
      title: `Artwork restored: ${archive.snapshot.title || 'Untitled artwork'}`,
      message: restorationMessage(archive),
      artwork: archive.entityId,
      // The same artwork can be removed and restored again later, so include
      // this removal's timestamp rather than deduplicating by artwork alone.
      dedupe_key: `artwork_restored:${archive._id}:${new Date(archive.deletedAt).getTime()}`,
    });
    void sendNotificationEmailInBackground(notification);
    return notification;
  } catch (error) {
    // A notification failure must never undo a successful artwork restore.
    console.error('Artwork restoration notification could not be created:', error.message);
    return null;
  }
}

module.exports = { notifyArtworkRestored, restorationMessage };
