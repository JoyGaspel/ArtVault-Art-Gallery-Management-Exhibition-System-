const test = require('node:test');
const assert = require('node:assert/strict');
const likeRoutes = require('../routes/likeRoutes');
const artistRoutes = require('../routes/artistRoutes');
const { updateMyProfile } = require('../controllers/artistController');
const { createArtwork, updateArtwork } = require('../controllers/artworkController');
const artworkRoutes = require('../routes/artworkRoutes');
const { requireAuth } = require('../middleware/auth');
const { signup } = require('../controllers/authController');
const Artwork = require('../models/Artwork');

function response() {
  return {
    code: 200,
    body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('the artwork-like monitoring endpoint is main-admin only', () => {
  const route = likeRoutes.stack.find((layer) => layer.route?.path === '/likes' && layer.route.methods.get);
  assert.ok(route);
  for (const role of ['artist', 'sub_admin', 'admin']) {
    const res = response();
    let allowed = false;
    route.route.stack[1].handle({ user: { role } }, res, () => { allowed = true; });
    assert.equal(allowed, false);
    assert.equal(res.code, 403);
  }
  let allowed = false;
  route.route.stack[1].handle({ user: { role: 'main_admin' } }, response(), () => { allowed = true; });
  assert.equal(allowed, true);
});

test('administrators cannot edit their own public profile through the artist endpoint', async () => {
  for (const role of ['admin', 'sub_admin', 'main_admin']) {
    const res = response();
    await updateMyProfile({ user: { role }, body: { name: 'Changed' } }, res, (error) => { throw error; });
    assert.equal(res.code, 403);
  }
});

test('administrator directory cannot edit artist profiles, while owner editing remains available', () => {
  assert.equal(artistRoutes.stack.some((layer) => layer.route?.path === '/admin/:id' && layer.route.methods.put), false);
  assert.equal(artistRoutes.stack.some((layer) => layer.route?.path === '/me' && layer.route.methods.put), true);
});

test('signup rejects requests without accepted terms before creating an account', async () => {
  const res = response();
  await signup({ body: { name: 'Test Artist', email: 'artist@example.com', password: 'password123' } }, res, (error) => { throw error; });
  assert.equal(res.code, 400);
  assert.match(res.body.message, /Terms and Conditions/);
});

test('signup rejects extra spaces in names before creating an account', async () => {
  for (const name of [' Test Artist', 'Test  Artist', 'Test Artist ']) {
    const res = response();
    await signup({ body: { name, firstName: 'Test', lastName: 'Artist', email: 'artist@example.com', password: 'password123', acceptedTerms: true } }, res, (error) => { throw error; });
    assert.equal(res.code, 400);
  }
  const res = response();
  await signup({ body: { name: 'Test Artist', firstName: 'Test', lastName: 'Artist  Jr', email: 'artist@example.com', password: 'password123', acceptedTerms: true } }, res, (error) => { throw error; });
  assert.equal(res.code, 400);
});

test('artwork upload rejects missing or oversized category lists before database writes', async () => {
  for (const categories of [[], Array(6).fill('Digital Art'), [''], ['Not a real category']]) {
    const res = response();
    let validationError = null;
    await createArtwork({ user: { role: 'artist' }, body: { title: 'Test work', categories, ownershipDeclared: true } }, res, (error) => { validationError = error; });
    assert.equal(validationError?.status, 400);
  }
});

test('artwork upload requires an explicit ownership or permission declaration', async () => {
  for (const ownershipDeclared of [undefined, false, 'true']) {
    const res = response();
    await createArtwork({ user: { role: 'artist' }, body: { title: 'Test work', categories: ['Digital Art'], ownershipDeclared } }, res, (error) => { throw error; });
    assert.equal(res.code, 400);
    assert.match(res.body.message, /permission/);
  }
});

test('new artwork uploads require private proof and keep the proof route authenticated', async () => {
  const res = response();
  await createArtwork({ user: { role: 'artist' }, body: { title: 'Test work', categories: ['Digital Art'], ownershipDeclared: true } }, res, (error) => { throw error; });
  assert.equal(res.code, 400);
  assert.match(res.body.message, /proof/);
  const route = artworkRoutes.stack.find((layer) => layer.route?.path === '/:id/ownership-evidence' && layer.route.methods.get);
  assert.ok(route);
  assert.equal(route.route.stack[0].handle, requireAuth);
});

test('new artwork uploads require a display image before any database write', async (t) => {
  t.mock.method(Artwork, 'create', () => { throw new Error('Artwork must not be created without an image.'); });
  const res = response();
  await createArtwork({ user: { role: 'artist' }, body: {
    title: 'Test work', categories: ['Digital Art'], ownershipDeclared: true,
    ownership_evidence_path: 'proof-present',
  } }, res, (error) => { throw error; });
  assert.equal(res.code, 400);
  assert.match(res.body.message, /artwork image/);
});

test('artwork upload rejects obvious non-material and repeated materials', async () => {
  for (const materials of [['https://example.com'], ['12345'], ['asdf'], ['aaaaaaa'], ['asfjaHFUJKASDG FSDGF'], ['Canvas', 'canvas']]) {
    const res = response();
    let validationError;
    await createArtwork({ user: { role: 'artist' }, body: { title: 'Test work', categories: ['Digital Art'], materials, ownershipDeclared: true } }, res, (error) => { validationError = error; });
    assert.equal(validationError?.status, 400);
  }
});

test('artwork edit rejects unrecognized materials before saving', async () => {
  let saved = false;
  let validationError;
  await updateArtwork({ artwork: { categories: ['Traditional Art'], materials: [], save: async () => { saved = true; } }, body: { materials: ['asfjaHFUJKASDG FSDGF'] } }, response(), (error) => { validationError = error; });
  assert.equal(validationError?.status, 400);
  assert.equal(saved, false);
});

test('frontend and backend use the same material terms', () => {
  const serverTerms = require('../data/materialTerms.json');
  const clientTerms = require('../../client/src/data/materialTerms.json');
  assert.deepEqual(serverTerms, clientTerms);
});
