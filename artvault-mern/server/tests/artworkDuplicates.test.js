const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const Artwork = require('../models/Artwork');
const { fingerprint, distance, checkDuplicates } = require('../services/artworkDuplicates');
test('local fingerprints flag duplicates without returning private records', async (t) => {
  const buffer = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#884422' } }).png().toBuffer();
  const image = `data:image/png;base64,${buffer.toString('base64')}`;
  const hashes = await fingerprint(image);
  assert.equal(hashes.imageFingerprint.length, 16); assert.equal(hashes.imageDigest.length, 64);
  assert.equal(distance('0000000000000000', '000000000000000f'), 4);
  t.mock.method(Artwork, 'find', (filter) => {
    assert.equal(filter._id.$ne, 'current');
    return { select: () => ({ lean: () => ({ cursor: async function* () { yield { ...hashes, title: 'Private work' }; } }) }) };
  });
  const result = await checkDuplicates(image, 'current');
  assert.equal(result.status, 'possible_duplicate'); assert.equal(result.title, undefined);
});
