const test = require('node:test');
const assert = require('node:assert/strict');
const { checkArtworkOnWeb } = require('../services/artworkWebCheck');
const artworkRoutes = require('../routes/artworkRoutes');
const { canViewArtwork } = require('../utils/artworkVisibility');
const sharp = require('sharp');

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fN8AAAAASUVORK5CYII=';

test('unconfigured checker is explicit and does not claim to have scanned', async () => {
  const original = process.env.ARTWORK_WEB_CHECK_ENABLED;
  delete process.env.ARTWORK_WEB_CHECK_ENABLED;
  try { assert.deepEqual(await checkArtworkOnWeb(image), { status: 'disabled', urls: [] }); }
  finally { if (original === undefined) delete process.env.ARTWORK_WEB_CHECK_ENABLED; else process.env.ARTWORK_WEB_CHECK_ENABLED = original; }
});

test('scanner flags only full or partial matches and treats API failure as unavailable', async (t) => {
  const enabled = process.env.ARTWORK_WEB_CHECK_ENABLED;
  const key = process.env.GOOGLE_VISION_API_KEY;
  const oldFetch = global.fetch;
  process.env.ARTWORK_WEB_CHECK_ENABLED = 'true';
  process.env.GOOGLE_VISION_API_KEY = 'test-key';
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#8844aa' } }).png().toBuffer();
  const sample = `data:image/png;base64,${png.toString('base64')}`;
  t.after(() => {
    global.fetch = oldFetch;
    if (enabled === undefined) delete process.env.ARTWORK_WEB_CHECK_ENABLED; else process.env.ARTWORK_WEB_CHECK_ENABLED = enabled;
    if (key === undefined) delete process.env.GOOGLE_VISION_API_KEY; else process.env.GOOGLE_VISION_API_KEY = key;
  });
  global.fetch = async () => ({ ok: true, json: async () => ({ responses: [{ webDetection: { visuallySimilarImages: [{ url: 'https://example.com/similar' }] } }] }) });
  assert.deepEqual(await checkArtworkOnWeb(sample), { status: 'no_match', urls: [] });
  global.fetch = async () => ({ ok: true, json: async () => ({ responses: [{ webDetection: { fullMatchingImages: [{ url: 'https://example.com/match' }] } }] }) });
  assert.deepEqual(await checkArtworkOnWeb(sample), { status: 'possible_match', urls: ['https://example.com/match'] });
  global.fetch = async () => ({ ok: false });
  assert.deepEqual(await checkArtworkOnWeb(sample), { status: 'unavailable', urls: [] });
});

test('pending public artwork is protected from anonymous readers', () => {
  const work = { artist: 'owner', visibility: 'public', reviewStatus: 'pending' };
  assert.equal(canViewArtwork(work, null), false);
  assert.equal(canViewArtwork(work, { _id: 'stranger', role: 'artist' }), false);
  assert.equal(canViewArtwork(work, { _id: 'owner', role: 'artist' }), true);
  assert.equal(canViewArtwork(work, { _id: 'admin', role: 'main_admin' }), true);
});

test('pending queue requires administrator authentication; only main admin can decide', () => {
  const queue = artworkRoutes.stack.find((layer) => layer.route?.path === '/admin/pending');
  const decision = artworkRoutes.stack.find((layer) => layer.route?.path === '/:id/review');
  assert.equal(queue.route.stack[0].name, 'requireAuth');
  assert.equal(queue.route.stack.at(-1).name, 'listPendingArtworkReviews');
  assert.equal(decision.route.stack[0].name, 'requireAuth');
  assert.equal(decision.route.stack.at(-1).name, 'reviewArtwork');
  let reached = false;
  decision.route.stack[1].handle({ user: { role: 'sub_admin' } }, { status() { return this; }, json() {} }, () => { reached = true; });
  assert.equal(reached, false);
});
