const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Artwork = require('../models/Artwork');
const artworkRoutes = require('../routes/artworkRoutes');
const { canViewArtwork, publicArtworkFilter } = require('../utils/artworkVisibility');

const owner = new mongoose.Types.ObjectId();
const other = new mongoose.Types.ObjectId();

test('existing artworks remain public by default', () => {
  const artwork = new Artwork({ title: 'Legacy piece', artist: owner });
  assert.equal(artwork.visibility, 'public');
  assert.equal(canViewArtwork({ artist: owner }, null), true);
});

test('only owner and main administrator can see private artwork', () => {
  const artwork = { artist: owner, visibility: 'private' };
  assert.equal(canViewArtwork(artwork, null), false);
  assert.equal(canViewArtwork(artwork, { _id: other, role: 'artist' }), false);
  assert.equal(canViewArtwork(artwork, { _id: other, role: 'sub_admin' }), false);
  assert.equal(canViewArtwork(artwork, { _id: other, role: 'admin' }), false);
  assert.equal(canViewArtwork(artwork, { _id: owner, role: 'artist' }), true);
  assert.equal(canViewArtwork(artwork, { _id: owner, role: 'sub_admin' }), true);
  assert.equal(canViewArtwork(artwork, { _id: owner, role: 'admin' }), true);
  assert.equal(canViewArtwork(artwork, { _id: other, role: 'main_admin' }), true);
});

test('public query excludes private works and keeps legacy documents', () => {
  const filter = publicArtworkFilter();
  assert.deepEqual(JSON.parse(JSON.stringify(filter)), { visibility: { $ne: 'private' } });
  const query = Artwork.find(filter);
  query._castConditions();
  assert.deepEqual(JSON.parse(JSON.stringify(query.getFilter())), { visibility: { $ne: 'private' } });
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

test('personal collection routes are artist-only and main-admin review stays separate', () => {
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
  let allowed = false;
  review.route.stack[1].handle({ user: { role: 'admin' } }, {
    status(code) { assert.equal(code, 403); return this; },
    json() { return this; },
  }, () => { allowed = true; });
  assert.equal(allowed, false, 'legacy administrators must not access the main-admin Vault review');
});
