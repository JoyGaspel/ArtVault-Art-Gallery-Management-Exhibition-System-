const test = require('node:test');
const assert = require('node:assert/strict');
const Artwork = require('../models/Artwork');
const { getAdminArtworkSummary } = require('../controllers/artworkController');

test('admin artwork summary counts the whole public gallery and private Vaults', async (t) => {
  const filters = [];
  t.mock.method(Artwork, 'countDocuments', async (filter) => {
    filters.push(filter);
    return filter.visibility === 'private' ? 4 : filter.reviewStatus === 'pending' ? 1 : 12;
  });
  t.mock.method(Artwork, 'distinct', async (field, filter) => {
    assert.equal(field, 'artist');
    assert.notEqual(filter.visibility, 'private');
    return ['artist-one', 'artist-two'];
  });
  const response = { headers: {}, set(key, value) { this.headers[key] = value; }, json(body) { this.body = body; } };
  await getAdminArtworkSummary({}, response, (error) => { throw error; });
  assert.equal(filters.length, 3);
  assert.equal(filters[1].visibility, 'private');
  assert.deepEqual(response.body, { publicCount: 12, vaultCount: 4, pendingCount: 1, contributingArtistCount: 2 });
  assert.equal(response.headers['Cache-Control'], 'no-store');
});
