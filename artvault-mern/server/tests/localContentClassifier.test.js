const test = require('node:test');
const assert = require('node:assert/strict');
const classifier = require('../services/localContentClassifier');

test('bundled model loads and performs real offline inference without API credentials', { timeout: 65000 }, async (t) => {
  t.after(() => classifier.close());
  // Worker disables fetch itself; this exercises installed weights, not mocks.
  const predictions = await classifier.classify(Buffer.alloc(224 * 224 * 3, 120));
  assert.equal(predictions.length, 5);
  assert.deepEqual(predictions.map((item) => item.className).sort(), ['Drawing', 'Hentai', 'Neutral', 'Porn', 'Sexy']);
  assert.ok(predictions.every((item) => Number.isFinite(item.probability) && item.probability >= 0 && item.probability <= 1));
  assert.ok(Math.abs(predictions.reduce((sum, item) => sum + item.probability, 0) - 1) < 0.02);
});
