const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Archive = require('../models/Archive');
const { archiveOnce } = require('../services/archiveService');
const { RECOVERY_DAYS, artistRecoveryDeadline, isArtistRecoverable } = require('../services/artistArtworkRecovery');
const { listArchives, listMyRemovedArtworks, restoreMyRemovedArtwork } = require('../controllers/archiveController');

test('artist artwork recovery ends after exactly 30 days', () => {
  const removedAt = new Date('2026-10-19T00:00:00.000Z');
  const deadline = artistRecoveryDeadline(removedAt);
  assert.equal(RECOVERY_DAYS, 30);
  assert.equal(deadline.toISOString(), '2026-11-18T00:00:00.000Z');
  const archive = { entityType: 'artwork', artistRecoverUntil: deadline };
  assert.ok(isArtistRecoverable(archive, new Date(deadline.getTime() - 1)));
  assert.ok(!isArtistRecoverable(archive, deadline));
  assert.ok(!isArtistRecoverable({ entityType: 'exhibit', artistRecoverUntil: deadline }, removedAt));
});

test('artist removal stores the recovery deadline with the first archive snapshot', async (t) => {
  const artworkId = new mongoose.Types.ObjectId();
  const artistId = new mongoose.Types.ObjectId();
  const deadline = artistRecoveryDeadline();
  let inserted;
  t.mock.method(Archive, 'updateOne', async (_filter, update) => { inserted = update.$setOnInsert; return { upsertedCount: 1 }; });
  await archiveOnce({ entityType: 'artwork', snapshot: { _id: artworkId, artist: artistId }, deletedBy: artistId, artistRecoverUntil: deadline });
  assert.equal(inserted.artistRecoverUntil, deadline);
  assert.equal(String(inserted.deletedBy), String(artistId));
});

test('an artist cannot restore another artist’s removed artwork', async (t) => {
  const artistId = new mongoose.Types.ObjectId();
  const archiveId = new mongoose.Types.ObjectId();
  t.mock.method(Archive, 'findOne', async (filter) => {
    assert.equal(String(filter.deletedBy), String(artistId));
    assert.equal(String(filter['snapshot.artist']), String(artistId));
    assert.ok(filter.artistRecoverUntil.$gt instanceof Date);
    return null;
  });
  const response = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await restoreMyRemovedArtwork({ user: { _id: artistId }, params: { id: String(archiveId) } }, response, (error) => { throw error; });
  assert.equal(response.code, 404);
});

test('artist recovery list keeps its server-created date filter under query sanitization', async (t) => {
  const artistId = new mongoose.Types.ObjectId();
  t.mock.method(Archive, 'find', (filter) => {
    const safeFilter = mongoose.sanitizeFilter(filter);
    assert.ok(safeFilter.artistRecoverUntil.$gt instanceof Date);
    assert.equal(safeFilter.artistRecoverUntil.$eq, undefined);
    return { select() { return this; }, sort() { return this; }, async lean() { return []; } };
  });
  const response = { set() {}, json(body) { this.body = body; } };
  await listMyRemovedArtworks({ user: { _id: artistId } }, response, (error) => { throw error; });
  assert.deepEqual(response.body.artworks, []);
});

test('admin archive list keeps the 30-day cutoff under query sanitization', async (t) => {
  t.mock.method(Archive, 'find', (filter) => {
    const safeFilter = mongoose.sanitizeFilter(filter);
    assert.ok(safeFilter.$or[1].artistRecoverUntil.$lte instanceof Date);
    assert.equal(safeFilter.$or[1].artistRecoverUntil.$eq, undefined);
    return { select() { return this; }, sort() { return this; }, populate() { return this; }, async lean() { return []; } };
  });
  const response = { set() {}, json(body) { this.body = body; } };
  await listArchives({ user: { role: 'main_admin' } }, response, (error) => { throw error; });
  assert.deepEqual(response.body.archives, []);
});
