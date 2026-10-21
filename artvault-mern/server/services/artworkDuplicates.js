const sharp = require('sharp');
const crypto = require('node:crypto');
const Artwork = require('../models/Artwork');

async function fingerprint(image) {
  const source = Buffer.from(image.split(',')[1], 'base64');
  const pixels = await sharp(source).rotate().flatten({ background: '#ffffff' }).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits = (bits << 1n) | BigInt(pixels[y * 9 + x] > pixels[y * 9 + x + 1]);
  return { imageDigest: crypto.createHash('sha256').update(source).digest('hex'), imageFingerprint: bits.toString(16).padStart(16, '0') };
}
function distance(a, b) {
  let bits = BigInt(`0x${a}`) ^ BigInt(`0x${b}`); let count = 0;
  while (bits) { bits &= bits - 1n; count++; }
  return count;
}
async function checkDuplicates(image, excludeId) {
  const hashes = await fingerprint(image);
  const filter = excludeId ? { _id: { $ne: excludeId } } : {};
  let matched = false;
  // Read fingerprints only, never other artists' private media or names.
  const cursor = Artwork.find(filter).select('+imageDigest +imageFingerprint').lean().cursor();
  for await (const work of cursor) {
    if (work.imageDigest === hashes.imageDigest || (/^[0-9a-f]{16}$/.test(work.imageFingerprint || '') && distance(work.imageFingerprint, hashes.imageFingerprint) <= 5)) matched = true;
  }
  return { ...hashes, status: matched ? 'possible_duplicate' : 'no_local_match' };
}
module.exports = { fingerprint, distance, checkDuplicates };
