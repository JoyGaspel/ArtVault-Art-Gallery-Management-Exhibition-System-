const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { assessOwnershipProof, checkArtworkOwnership } = require('../services/artworkOwnershipCheck');

test('proof assessment conservatively handles duplicate evidence and unavailable or malformed responses', async (t) => {
  const oldFetch = global.fetch;
  const names = ['GEMINI_API_KEY', 'GOOGLE_VISION_API_KEY', 'ARTWORK_WEB_CHECK_ENABLED'];
  const original = names.map((name) => process.env[name]);
  t.after(() => {
    global.fetch = oldFetch;
    names.forEach((name, index) => { if (original[index] === undefined) delete process.env[name]; else process.env[name] = original[index]; });
  });
  const makeImage = async (background) => `data:image/png;base64,${(await sharp({ create: { width: 8, height: 8, channels: 3, background } }).png().toBuffer()).toString('base64')}`;
  const image = await makeImage('#112233'); const proof = await makeImage('#ffeedd');
  delete process.env.GEMINI_API_KEY;
  assert.equal((await assessOwnershipProof(image, proof)).status, 'unavailable');
  assert.equal((await assessOwnershipProof(image, image)).status, 'uncertain');
  assert.equal((await assessOwnershipProof(image, '')).status, 'uncertain');
  process.env.GEMINI_API_KEY = 'test';
  const answer = (text, finishReason = 'STOP') => {
    global.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] }) });
  };
  for (const result of [
    { assessment: 'credible', sameArtwork: false, creationProcessVisible: true },
    { assessment: 'credible', sameArtwork: true, creationProcessVisible: false },
    { assessment: 'uncertain', sameArtwork: true, creationProcessVisible: true },
  ]) {
    answer(JSON.stringify(result));
    assert.equal((await assessOwnershipProof(image, proof)).status, 'uncertain');
  }
  for (const text of ['invalid JSON', '{}', '{"assessment":"credible","sameArtwork":"true","creationProcessVisible":true}']) {
    answer(text);
    assert.equal((await assessOwnershipProof(image, proof)).status, 'unavailable');
  }
  answer('{}', 'SAFETY');
  assert.equal((await assessOwnershipProof(image, proof)).status, 'unavailable');
  global.fetch = async () => { throw new Error('timeout'); };
  assert.equal((await assessOwnershipProof(image, proof)).status, 'unavailable');
  global.fetch = async () => ({ ok: false });
  assert.equal((await assessOwnershipProof(image, proof)).status, 'unavailable');
  process.env.GOOGLE_VISION_API_KEY = 'test';
  process.env.ARTWORK_WEB_CHECK_ENABLED = 'true';
  global.fetch = async () => ({ ok: true, json: async () => ({ responses: [{ webDetection: {} }] }) });
  delete process.env.GEMINI_API_KEY;
  const unavailable = await checkArtworkOwnership(image, proof, true);
  assert.equal(unavailable.reviewStatus, 'pending');
  assert.equal(unavailable.reviewReason, 'proof_check_unavailable');
  global.fetch = async () => ({ ok: true, json: async () => ({ responses: [{}] }) });
  const missingWeb = await checkArtworkOwnership(image, proof, true);
  assert.equal(missingWeb.reviewStatus, 'pending');
  assert.equal(missingWeb.reviewReason, 'check_unavailable');
});
