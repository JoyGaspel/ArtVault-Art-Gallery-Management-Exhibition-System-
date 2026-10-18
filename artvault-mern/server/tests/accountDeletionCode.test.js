const test = require('node:test');
const assert = require('node:assert/strict');
const Artist = require('../models/Artist');
const Artwork = require('../models/Artwork');
const mailer = require('../config/mailer');
const { requestDeletionCode, deleteMyAccount } = require('../controllers/artistController');

function response() {
  return { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

test('account deletion cannot begin without a valid email code', async (t) => {
  let artworkRead = false;
  t.mock.method(Artwork, 'find', () => { artworkRead = true; });
  const res = response();
  await deleteMyAccount({ user: { _id: 'artist-id', role: 'artist' }, body: {} }, res, (error) => { throw error; });
  assert.equal(res.code, 400);
  assert.equal(artworkRead, false);
});

test('incorrect deletion code does not archive or remove artworks', async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret-for-deletion-code';
  t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
  t.mock.method(Artist, 'findOneAndUpdate', async () => null);
  t.mock.method(Artist, 'updateOne', async () => ({ acknowledged: true }));
  let artworkRead = false;
  t.mock.method(Artwork, 'find', () => { artworkRead = true; });
  const res = response();
  await deleteMyAccount({ user: { _id: 'artist-id', role: 'artist' }, body: { code: '12345678' } }, res, (error) => { throw error; });
  assert.equal(res.code, 400);
  assert.equal(artworkRead, false);
});

test('deletion code is sent to the registered email and stored only as a hash', async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret-for-deletion-code';
  t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
  t.mock.method(mailer, 'emailNotificationsEnabled', () => true);
  t.mock.method(Artist, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: 'artist-id', email: 'artist@example.com' }) }) }));
  let stored;
  t.mock.method(Artist, 'updateOne', async (_filter, update) => { stored = update.$set; return { acknowledged: true }; });
  let email;
  t.mock.method(mailer, 'sendEmail', async (payload) => { email = payload; return { accepted: [payload.to] }; });
  const res = response();
  await requestDeletionCode({ user: { _id: 'artist-id', role: 'artist' } }, res, (error) => { throw error; });
  assert.equal(res.code, 200);
  assert.equal(email.to, 'artist@example.com');
  assert.match(email.text, /\b\d{8}\b/);
  assert.notEqual(stored.deleteCodeHash, email.text.match(/\b\d{8}\b/)[0]);
  assert.equal(stored.deleteCodeAttempts, 0);
});
