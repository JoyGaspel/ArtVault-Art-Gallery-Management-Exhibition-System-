const test = require('node:test');
const assert = require('node:assert/strict');
const Exhibit = require('../models/Exhibit');
const Artist = require('../models/Artist');
const Entry = require('../models/SubmitExhibitEntry');
const Notification = require('../models/Notification');
const { reconcileExhibitLifecycle } = require('../services/exhibitLifecycleService');

function query(value) { return { select() { return { lean: async () => value }; } }; }

test('a live exhibit sends a deduplicated start notice and marks it sent', async (t) => {
  const exhibit = { _id: 'show-1', name: 'Demo show', event_date: new Date('2026-10-20T00:00:00Z'), starts_at: new Date('2026-10-20T01:00:00Z'), ends_at: new Date('2026-10-20T09:00:00Z'), lifecycle_enabled: true };
  const notices = [];
  t.mock.method(Exhibit, 'find', () => query([exhibit]));
  t.mock.method(Entry, 'find', () => query([]));
  t.mock.method(Artist, 'find', () => query([{ _id: 'artist-1' }]));
  t.mock.method(Notification, 'updateOne', async (filter, update) => { notices.push({ filter, update }); return { upsertedCount: 0 }; });
  t.mock.method(Exhibit, 'updateOne', async (filter, update) => { exhibit.start_notification_sent_at = update.$set.start_notification_sent_at; });
  await reconcileExhibitLifecycle(new Date('2026-10-20T02:00:00Z'));
  await reconcileExhibitLifecycle(new Date('2026-10-20T03:00:00Z'));
  assert.equal(notices.length, 1);
  assert.equal(notices[0].filter.dedupe_key, 'exhibit:show-1:start');
  assert.ok(exhibit.start_notification_sent_at);
});

test('an ended exhibit expires pending entries and sends only one end notice', async (t) => {
  const exhibit = { _id: 'show-2', name: 'Ended show', event_date: new Date('2026-10-20T00:00:00Z'), lifecycle_enabled: true };
  const notices = [];
  t.mock.method(Exhibit, 'find', () => query([exhibit]));
  t.mock.method(Entry, 'updateMany', async () => ({ modifiedCount: 1 }));
  t.mock.method(Entry, 'find', (filter) => query(filter.exhibit ? [{ _id: 'entry-1', artist: 'artist-1' }] : filter.status === 'pending' ? [{ exhibit: 'show-2' }] : []));
  t.mock.method(Entry, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(Artist, 'find', () => query([{ _id: 'artist-1' }]));
  t.mock.method(Notification, 'updateOne', async (filter) => { notices.push(filter.dedupe_key); return { upsertedCount: 0 }; });
  t.mock.method(Exhibit, 'updateOne', async (filter, update) => { exhibit.end_notification_sent_at = update.$set.end_notification_sent_at; });
  await reconcileExhibitLifecycle(new Date('2026-10-21T00:00:00Z'));
  assert.deepEqual(notices, ['submission:entry-1:expired', 'exhibit:show-2:end']);
  assert.equal(exhibit.start_notification_sent_at, undefined, 'missed start events are not sent after the show ended');
});

test('legacy past exhibits do not create retrospective start or end notices', async (t) => {
  const exhibit = { _id: 'old-show', name: 'Old show', event_date: new Date('2026-09-01T00:00:00Z') };
  let notified = false;
  t.mock.method(Exhibit, 'find', () => query([exhibit]));
  t.mock.method(Entry, 'updateMany', async () => ({ modifiedCount: 0 }));
  t.mock.method(Entry, 'find', () => query([]));
  t.mock.method(Notification, 'updateOne', async () => { notified = true; });
  await reconcileExhibitLifecycle(new Date('2026-10-20T00:00:00Z'));
  assert.equal(notified, false);
});
