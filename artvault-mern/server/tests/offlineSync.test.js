const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Artwork = require('../models/Artwork');
const artworkRoutes = require('../routes/artworkRoutes');
const { syncArtworkMetadata } = require('../controllers/artworkController');

const owner = new mongoose.Types.ObjectId();
const artworkId = new mongoose.Types.ObjectId();
const originalDate = '2026-10-12T05:12:00.000Z';

function response() {
  return {
    code: 200,
    body: null,
    status(code) { this.code = code; return this; },
    set() { return this; },
    json(body) { this.body = body; return this; },
  };
}

function request(body = {}) {
  return { params: { id: String(artworkId) }, user: { _id: owner, role: 'artist' }, body: {
    expectedUpdatedAt: originalDate,
    title: 'Updated title',
    description: 'Updated description',
    categories: ['Painting'],
    materials: [],
    ...body,
  } };
}

test('offline sync endpoint is authenticated and artist-only', () => {
  const route = artworkRoutes.stack.find((layer) => layer.route?.path === '/:id/sync-metadata');
  assert.ok(route);
  assert.equal(route.route.stack[0].name, 'requireAuth');
  assert.equal(route.route.stack.at(-1).name, 'syncArtworkMetadata');
  let allowed = false;
  route.route.stack[1].handle({ user: { role: 'main_admin' } }, response(), () => { allowed = true; });
  assert.equal(allowed, false);
});

test('offline sync rejects missing snapshot version before writing', async () => {
  const res = response();
  await syncArtworkMetadata(request({ expectedUpdatedAt: '' }), res, (error) => { throw error; });
  assert.equal(res.code, 400);
});

test('offline sync uses owner, public visibility, and exact version in atomic update', async (t) => {
  let filter;
  t.mock.method(Artwork, 'findOneAndUpdate', async (query) => { filter = query; return null; });
  t.mock.method(Artwork, 'findById', () => ({ select: () => ({ lean: async () => ({
    artist: owner,
    visibility: 'public',
    title: 'Newer online title',
    updated_at: new Date('2026-10-14T05:12:00.000Z'),
  }) }) }));
  const res = response();
  await syncArtworkMetadata(request(), res, (error) => { throw error; });
  assert.equal(String(filter.artist), String(owner));
  assert.deepEqual(filter.visibility, { $ne: 'private' });
  assert.equal(filter.updated_at.toISOString(), originalDate);
  assert.equal(res.code, 409);
  assert.equal(res.body.current.title, 'Newer online title');
});

test('offline sync does not expose another artist’s artwork in a conflict', async (t) => {
  t.mock.method(Artwork, 'findOneAndUpdate', async () => null);
  t.mock.method(Artwork, 'findById', () => ({ select: () => ({ lean: async () => ({
    artist: new mongoose.Types.ObjectId(), visibility: 'public', title: 'Private to owner',
  }) }) }));
  const res = response();
  await syncArtworkMetadata(request(), res, (error) => { throw error; });
  assert.equal(res.code, 404);
  assert.equal(res.body.current, undefined);
});
