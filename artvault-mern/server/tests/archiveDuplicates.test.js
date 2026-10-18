const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Archive = require('../models/Archive');
const Artist = require('../models/Artist');
const AuditLog = require('../models/AuditLog');
const { archiveOnce, archiveId } = require('../services/archiveService');
const { setArtistStatus, setArtistRole, updateMyProfile } = require('../controllers/artistController');

const entityId = new mongoose.Types.ObjectId('64b000000000000000000001');
const deletedBy = new mongoose.Types.ObjectId('64b000000000000000000002');

test('archive retries use one stable identity and preserve the first snapshot', async (t) => {
  const records = new Map();
  t.mock.method(Archive, 'updateOne', async (filter, update, options) => {
    const key = `${filter.entityType}:${filter.entityId}`;
    assert.equal(options.upsert, true);
    if (records.has(key)) return { upsertedCount: 0 };
    records.set(key, update.$setOnInsert);
    return { upsertedCount: 1 };
  });
  const snapshot = { _id: entityId, title: 'First title' };
  assert.equal(await archiveOnce({ entityType: 'artwork', snapshot, deletedBy }), true);
  assert.equal(await archiveOnce({ entityType: 'artwork', snapshot: { ...snapshot, title: 'Retry title' }, deletedBy }), false);
  assert.equal(records.size, 1);
  assert.equal(records.values().next().value.snapshot.title, 'First title');
  assert.equal(records.values().next().value._id, archiveId('artwork', entityId));
  assert.notEqual(archiveId('artist', entityId), archiveId('artwork', entityId));
});

test('a simultaneous archive retry treats a stable-id collision as already archived', async (t) => {
  t.mock.method(Archive, 'updateOne', async () => { const error = new Error('duplicate key'); error.code = 11000; throw error; });
  t.mock.method(Archive, 'exists', async (filter) => filter.entityType === 'artwork' && String(filter.entityId) === String(entityId));
  assert.equal(await archiveOnce({ entityType: 'artwork', snapshot: { _id: entityId }, deletedBy }), false);
});

test('unchanged artist status and role do not save or create duplicate audit entries', async (t) => {
  const artist = {
    _id: entityId, role: 'artist', status: 'active',
    toSafeObject() { return { id: this._id, role: this.role, status: this.status }; },
    save() { throw new Error('An unchanged artist must not be saved.'); },
  };
  t.mock.method(Artist, 'findOne', () => ({
    then(resolve) { return Promise.resolve(artist).then(resolve); },
    select() { return Promise.resolve(artist); },
  }));
  t.mock.method(AuditLog, 'create', () => { throw new Error('An unchanged action must not be logged.'); });
  const makeResponse = () => ({ json(body) { this.body = body; return this; } });
  const req = { params: { id: String(entityId) }, user: { _id: deletedBy, role: 'main_admin' } };
  const statusResponse = makeResponse();
  await setArtistStatus({ ...req, body: { status: 'active' } }, statusResponse, (error) => { throw error; });
  assert.match(statusResponse.body.message, /already up to date/);
  const roleResponse = makeResponse();
  await setArtistRole({ ...req, body: { role: 'artist' } }, roleResponse, (error) => { throw error; });
  assert.match(roleResponse.body.message, /already up to date/);
});

test('an unchanged profile update does not create a misleading activity entry', async (t) => {
  t.mock.method(AuditLog, 'create', () => { throw new Error('A no-op profile update must not be logged.'); });
  const artist = {
    _id: entityId, role: 'artist', name: 'Test Artist', firstName: 'Test', lastName: 'Artist',
    bio: '', specializations: [], avatar_path: '', emailLikes: true,
    emailSubmissionStatus: true, emailExhibits: true,
    save() { throw new Error('A no-op profile update must not be saved.'); },
    toSafeObject() { return { id: this._id, name: this.name }; },
  };
  const response = { json(body) { this.body = body; return this; } };
  await updateMyProfile({ user: artist, body: { emailLikes: true } }, response, (error) => { throw error; });
  assert.equal(response.body.artist.name, 'Test Artist');
});
