const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Artwork = require('../models/Artwork');
const artworkRoutes = require('../routes/artworkRoutes');
const { listVaultArtworks } = require('../controllers/artworkController');
const { canViewArtwork, publicArtworkFilter } = require('../utils/artworkVisibility');

const owner = new mongoose.Types.ObjectId();
const other = new mongoose.Types.ObjectId();

test('existing artworks remain public by default', () => {
  const artwork = new Artwork({ title: 'Legacy piece', artist: owner });
  assert.equal(artwork.visibility, 'public');
  assert.equal(canViewArtwork({ artist: owner }, null), true);
});

test('owner and administrator reviewers can see private artwork', () => {
  const artwork = { artist: owner, visibility: 'private' };
  assert.equal(canViewArtwork(artwork, null), false);
  assert.equal(canViewArtwork(artwork, { _id: other, role: 'artist' }), false);
  assert.equal(canViewArtwork(artwork, { _id: other, role: 'sub_admin' }), true);
  assert.equal(canViewArtwork(artwork, { _id: other, role: 'admin' }), false);
  assert.equal(canViewArtwork(artwork, { _id: owner, role: 'artist' }), true);
  assert.equal(canViewArtwork(artwork, { _id: owner, role: 'sub_admin' }), true);
  assert.equal(canViewArtwork(artwork, { _id: owner, role: 'admin' }), true);
  assert.equal(canViewArtwork(artwork, { _id: other, role: 'main_admin' }), true);
});

test('public query excludes private works and keeps legacy documents', () => {
  const filter = publicArtworkFilter();
  assert.deepEqual(JSON.parse(JSON.stringify(filter)), { visibility: { $ne: 'private' }, reviewStatus: { $nin: ['pending', 'rejected'] } });
  const query = Artwork.find(filter);
  query._castConditions();
  assert.deepEqual(JSON.parse(JSON.stringify(query.getFilter())), { visibility: { $ne: 'private' }, reviewStatus: { $nin: ['pending', 'rejected'] } });
});

test('detail and media routes check access before serving content', () => {
  for (const path of ['/:id', '/:id/image', '/:id/thumbnail']) {
    const route = artworkRoutes.stack.find((layer) => layer.route?.path === path && layer.route.methods.get);
    assert.ok(route, `missing ${path}`);
    assert.equal(route.route.stack[0].name, 'authorizeArtworkRead');
  }
});

test('owner portfolio is authenticated and separate from public-only exhibit picker', () => {
  const portfolio = artworkRoutes.stack.find((layer) => layer.route?.path === '/mine/portfolio');
  const picker = artworkRoutes.stack.find((layer) => layer.route?.path === '/mine');
  assert.ok(portfolio);
  assert.ok(picker);
  assert.equal(portfolio.route.stack[0].name, 'requireAuth');
  assert.equal(portfolio.route.stack.at(-1).name, 'listMyPortfolio');
  assert.equal(picker.route.stack.at(-1).name, 'listMyArtworks');
  let pickerAllowed = false;
  picker.route.stack[1].handle({ user: { role: 'sub_admin' } }, {
    status(code) { assert.equal(code, 403); return this; },
    json() { return this; },
  }, () => { pickerAllowed = true; });
  assert.equal(pickerAllowed, false);
});

test('private artwork lists retain authentication and role middleware', () => {
  for (const path of ['/vault', '/admin/vault']) {
    const route = artworkRoutes.stack.find((layer) => layer.route?.path === path && layer.route.methods.get);
    assert.ok(route, `missing ${path}`);
    assert.equal(route.route.stack[0].name, 'requireAuth');
    assert.equal(route.route.stack.at(-1).name, 'listVaultArtworks');
    assert.ok(route.route.stack.length >= 3, `${path} needs role authorization`);
  }
});

test('personal collection routes stay artist-only and administrator review stays separate', () => {
  for (const path of ['/mine/portfolio', '/vault']) {
    const route = artworkRoutes.stack.find((layer) => layer.route?.path === path);
    let allowed = false;
    route.route.stack[1].handle({ user: { role: 'artist' } }, {}, () => { allowed = true; });
    assert.equal(allowed, true, `${path} should accept artists`);
    for (const role of ['sub_admin', 'admin', 'main_admin']) {
      allowed = false;
      route.route.stack[1].handle({ user: { role } }, {
        status(code) { assert.equal(code, 403); return this; },
        json() { return this; },
      }, () => { allowed = true; });
      assert.equal(allowed, false, `${path} must reject ${role}`);
    }
  }
  const review = artworkRoutes.stack.find((layer) => layer.route?.path === '/admin/vault');
  for (const role of ['sub_admin', 'main_admin']) {
    let allowed = false;
    review.route.stack[1].handle({ user: { role } }, {}, () => { allowed = true; });
    assert.equal(allowed, true, `${role} should access Artist Vault review`);
  }
  for (const role of ['artist', 'admin']) {
    let allowed = false;
    review.route.stack[1].handle({ user: { role } }, {
      status(code) { assert.equal(code, 403); return this; },
      json() { return this; },
    }, () => { allowed = true; });
    assert.equal(allowed, false, `${role} must not access Artist Vault review`);
  }
});

test('sub-admins cannot edit or delete private artworks, even their own', async (t) => {
  t.mock.method(Artwork, 'findById', async () => ({ artist: owner, visibility: 'private' }));
  for (const method of ['put', 'delete']) {
    const route = artworkRoutes.stack.find((layer) => layer.route?.path === '/:id' && layer.route.methods[method]);
    let status;
    let nextCalled = false;
    await route.route.stack[1].handle({ params: { id: String(other) }, user: { _id: owner, role: 'sub_admin' } }, {
      status(code) { status = code; return this; },
      json() { return this; },
    }, () => { nextCalled = true; });
    assert.equal(status, 403);
    assert.equal(nextCalled, false);
  }
});

test('sub-admins cannot change Vault visibility', async () => {
  const route = artworkRoutes.stack.find((layer) => layer.route?.path === '/:id/visibility');
  let status;
  await route.route.stack[1].handle({ user: { role: 'sub_admin' } }, {
    status(code) { status = code; return this; },
    json() { return this; },
  }, () => {});
  assert.equal(status, 403);
});

test('sub-admins cannot create new private Vault artworks', async () => {
  const route = artworkRoutes.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.post);
  let status;
  await route.route.stack[1].handle({ user: { _id: owner, role: 'sub_admin' }, body: { title: 'Private draft', visibility: 'private' } }, {
    status(code) { status = code; return this; },
    json() { return this; },
  }, () => {});
  assert.equal(status, 403);
});

test('sub-admin Vault review lists all private artworks, not only their own', async (t) => {
  let filter;
  t.mock.method(Artwork, 'aggregate', async (pipeline) => { filter = pipeline[0].$match; return []; });
  t.mock.method(Artwork, 'countDocuments', async () => 0);
  let response;
  await listVaultArtworks({ query: {}, user: { _id: owner, role: 'sub_admin' } }, {
    set() {},
    json(data) { response = data; },
  }, (error) => { throw error; });
  assert.deepEqual(JSON.parse(JSON.stringify(filter)), { visibility: 'private', reviewStatus: { $nin: ['pending', 'rejected'] } });
  assert.deepEqual(response.artworks, []);
});
