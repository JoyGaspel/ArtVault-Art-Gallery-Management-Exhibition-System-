const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const classifier = require('../services/localContentClassifier');
const { requireSafeArtworkImages } = require('../services/artworkContentCheck');

const predictions = (porn = 0, hentai = 0, sexy = 0) => [
  { className: 'Drawing', probability: 0 }, { className: 'Neutral', probability: 1 - porn - hentai - sexy },
  { className: 'Porn', probability: porn }, { className: 'Hentai', probability: hentai }, { className: 'Sexy', probability: sexy },
];

test('local screening validates all images, blocks explicit categories, and fails closed', async (t) => {
  let answer = predictions(); let calls = 0;
  t.mock.method(classifier, 'classify', async (pixels) => {
    assert.equal(pixels.length, 224 * 224 * 3); calls++;
    if (answer instanceof Error) throw answer;
    return answer;
  });
  t.mock.method(global, 'fetch', async () => { throw new Error('No remote API allowed'); });
  const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#eeeeee' } }).png().toBuffer();
  const image = `data:image/png;base64,${png.toString('base64')}`;
  await requireSafeArtworkImages([]); assert.equal(calls, 0);
  await requireSafeArtworkImages([image, image]); assert.equal(calls, 2);
  for (const scores of [[0.2, 0, 0], [0, 0.2, 0], [0, 0, 0.4], [0.15, 0.15, 0.2]]) {
    answer = predictions(...scores);
    await assert.rejects(requireSafeArtworkImages([image]), { status: 422 });
  }
  for (answer of [null, [], predictions().slice(1), [...predictions().slice(0, 4), { className: 'Porn', probability: 0 }], predictions(NaN), predictions(2), new Error('Worker failed')]) {
    await assert.rejects(requireSafeArtworkImages([image]), { status: 503 });
  }
  answer = predictions();
  await assert.rejects(requireSafeArtworkImages(['data:image/png;base64,aW52YWxpZA==']), { status: 400 });
  const pixels = Buffer.alloc(8 * 16 * 3, 120); pixels.fill(240, 8 * 8 * 3);
  const frames = await sharp(pixels, { raw: { width: 8, height: 16, channels: 3, pageHeight: 8 } }).gif().toBuffer();
  await assert.rejects(requireSafeArtworkImages([`data:image/gif;base64,${frames.toString('base64')}`]), { status: 400 });
});

test('safe artwork cannot hide explicit ownership proof', async (t) => {
  let calls = 0;
  t.mock.method(classifier, 'classify', async () => ++calls === 1 ? predictions() : predictions(0.8));
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#eeeeee' } }).png().toBuffer();
  const image = `data:image/png;base64,${png.toString('base64')}`;
  await assert.rejects(requireSafeArtworkImages([image, image]), { status: 422 });
  assert.equal(calls, 2);
});
