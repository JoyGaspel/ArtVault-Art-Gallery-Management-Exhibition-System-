const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Artist = require('../models/Artist');
const Notification = require('../models/Notification');
const mailer = require('../config/mailer');
const { sendNotificationEmail } = require('../services/notificationEmailService');
const { notifyArtworkRestored, restorationMessage } = require('../services/artworkRestorationNotice');

const artistId = new mongoose.Types.ObjectId();
const artworkId = new mongoose.Types.ObjectId();
const archiveId = new mongoose.Types.ObjectId();
const archive = {
  _id: archiveId,
  entityId: artworkId,
  deletedAt: new Date('2026-10-19T00:00:00.000Z'),
  snapshot: { title: 'Sunrise', artist: artistId, visibility: 'private' },
};

test('restoration notice names the artwork, original destination, and lost associations', () => {
  const message = restorationMessage(archive, new Date('2026-10-20T00:00:00.000Z'));
  assert.match(message, /Sunrise/);
  assert.match(message, /your Vault/);
  assert.match(message, /exhibit placements and likes were not restored/);
  assert.match(restorationMessage({ ...archive, snapshot: { ...archive.snapshot, visibility: 'public' } }), /public gallery/);
});

test('a restored artwork creates a linked in-app notification', async (t) => {
  let created;
  t.mock.method(Notification, 'create', async (payload) => { created = payload; return payload; });
  t.mock.method(mailer, 'emailNotificationsEnabled', () => false);
  await notifyArtworkRestored(archive);
  assert.equal(created.type, 'artwork_restored');
  assert.equal(String(created.recipient), String(artistId));
  assert.equal(String(created.artwork), String(artworkId));
  assert.match(created.title, /Sunrise/);
  assert.match(created.dedupe_key, /artwork_restored:/);
});

test('restoration email follows its own artist preference', async (t) => {
  t.mock.method(mailer, 'emailNotificationsEnabled', () => true);
  let sent = null;
  t.mock.method(mailer, 'sendEmail', async (payload) => { sent = payload; return { accepted: [payload.to] }; });
  let enabled = false;
  t.mock.method(Artist, 'findById', () => ({ select() { return this; }, async lean() {
    return { email: 'artist@example.com', status: 'active', emailArtworkRestored: enabled };
  } }));
  const notification = { recipient: artistId, type: 'artwork_restored', title: 'Artwork restored: Sunrise', message: 'Sunrise returned to your Vault.', artwork: artworkId };
  assert.deepEqual(await sendNotificationEmail(notification), { skipped: true });
  assert.equal(sent, null);
  enabled = true;
  await sendNotificationEmail(notification);
  assert.equal(sent.to, 'artist@example.com');
  assert.match(sent.subject, /Artwork restored: Sunrise/);
  assert.match(sent.text, /Sunrise returned to your Vault/);
  assert.match(sent.text, new RegExp(`/artworks/${artworkId}`));
});
