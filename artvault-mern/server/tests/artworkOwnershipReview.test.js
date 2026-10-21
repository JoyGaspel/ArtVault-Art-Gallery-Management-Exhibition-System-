const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const Artwork = require('../models/Artwork');
const { createArtwork, updateArtwork, reviewArtwork } = require('../controllers/artworkController');

test('uploads and replacements automatically clear only with credible proof and no web matches', async (t) => {
  t.mock.method(require('../services/artworkDuplicates'), 'checkDuplicates', async () => ({ status: 'no_local_match' }));
  t.mock.method(require('../services/localContentClassifier'), 'classify', async () => [
    { className: 'Drawing', probability: 0.1 }, { className: 'Neutral', probability: 0.9 },
    { className: 'Porn', probability: 0 }, { className: 'Hentai', probability: 0 }, { className: 'Sexy', probability: 0 },
  ]);
  const old = { fetch: global.fetch, key: process.env.GOOGLE_VISION_API_KEY, gemini: process.env.GEMINI_API_KEY, enabled: process.env.ARTWORK_WEB_CHECK_ENABLED, create: Artwork.create };
  t.after(() => {
    global.fetch = old.fetch; Artwork.create = old.create;
    for (const [name, value] of [['GOOGLE_VISION_API_KEY', old.key], ['GEMINI_API_KEY', old.gemini], ['ARTWORK_WEB_CHECK_ENABLED', old.enabled]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  process.env.GOOGLE_VISION_API_KEY = 'test';
  process.env.GEMINI_API_KEY = 'test';
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#aaaaaa' } }).png().toBuffer();
  const image = `data:image/png;base64,${png.toString('base64')}`;
  const proofBuffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#887766' } }).png().toBuffer();
  const proof = `data:image/png;base64,${proofBuffer.toString('base64')}`;
  let proofStatus = 'credible'; let matched = false; let expected;
  global.fetch = async (url, options) => {
    if (url.includes('generativelanguage')) return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ assessment: proofStatus, sameArtwork: true, creationProcessVisible: true }) }] } }] }) };
    return { ok: true, json: async () => ({ responses: JSON.parse(options.body).requests.map(() => ({ safeSearchAnnotation: { adult: 'UNLIKELY', racy: 'UNLIKELY', violence: 'UNLIKELY' }, webDetection: matched ? { fullMatchingImages: [{ url: 'https://example.com/match' }] } : {} })) }) };
  };
  Artwork.create = async (data) => { assert.equal(data.reviewStatus, expected); assert.notEqual(data.thumbnail_path, 'untrusted'); return { ...data, toObject: () => ({ ...data }) }; };
  let response; let status;
  const res = { status(value) { status = value; return this; }, json(value) { response = value; } };
  const next = (error) => { throw error; };
  const body = { title: 'Original', image_path: image, thumbnail_path: 'untrusted', ownership_evidence_path: proof, categories: ['Painting'], ownershipDeclared: true };
  for (const scenario of [
    ['true', 'credible', false, 'clear'], ['true', 'uncertain', false, 'pending'],
    ['true', 'credible', true, 'pending'], ['false', 'credible', false, 'pending'],
  ]) {
    [process.env.ARTWORK_WEB_CHECK_ENABLED, proofStatus, matched, expected] = scenario;
    for (const visibility of ['public', 'private']) {
      await createArtwork({ user: { _id: 'owner', role: 'artist' }, body: { ...body, visibility } }, res, next);
      assert.equal(response.artwork.visibility, visibility);
      assert.equal(response.artwork.ownership_evidence_path, undefined);
    }
    for (const replacement of [{ image_path: image }, { ownership_evidence_path: proof }]) {
      const artwork = { image_path: image, categories: ['Painting'], reviewStatus: 'clear', save: async () => {}, toObject() { return { ...this }; } };
      await updateArtwork({ artwork, user: { _id: 'owner' }, body: { ...replacement, ownership_evidence_path: proof, ownershipDeclared: true } }, res, next);
      assert.equal(artwork.reviewStatus, expected);
      assert.equal(artwork.reviewedBy, null);
      assert.equal(response.artwork.ownership_evidence_path, undefined);
    }
  }
  for (const missing of [{ ownershipDeclared: false }, { ownershipDeclared: 'true' }, { ownership_evidence_path: '' }]) {
    await createArtwork({ user: { _id: 'owner', role: 'artist' }, body: { ...body, ...missing } }, res, next);
    assert.equal(status, 400);
    await updateArtwork({ artwork: {}, body: { image_path: image, ownership_evidence_path: proof, ownershipDeclared: true, ...missing } }, res, next);
    assert.equal(status, 400);
  }
});

test('approval requires evidence, independent review and the reviewed version', async (t) => {
  const oldFind = Artwork.findById;
  t.after(() => { Artwork.findById = oldFind; });
  const date = new Date();
  let candidate = { artist: 'owner', ownershipDeclared: true, ownership_evidence_path: 'proof', updated_at: date };
  Artwork.findById = () => ({ select: () => ({ lean: async () => candidate }) });
  let status;
  const res = { status(value) { status = value; return this; }, json() {} };
  const req = { params: { id: '507f1f77bcf86cd799439011' }, user: { _id: 'reviewer' }, body: { decision: 'approve' } };
  const next = (error) => { throw error; };
  await reviewArtwork(req, res, next); assert.equal(status, 400);
  req.body.ownershipVerified = true;
  candidate.ownership_evidence_path = '';
  await reviewArtwork(req, res, next); assert.equal(status, 409);
  candidate.ownership_evidence_path = 'proof'; req.user._id = 'owner';
  await reviewArtwork(req, res, next); assert.equal(status, 403);
  req.user._id = 'reviewer'; req.body.expectedUpdatedAt = new Date(0).toISOString();
  await reviewArtwork(req, res, next); assert.equal(status, 409);
});
