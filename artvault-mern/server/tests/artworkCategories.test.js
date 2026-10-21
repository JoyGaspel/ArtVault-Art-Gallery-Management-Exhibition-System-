const test = require('node:test');
const assert = require('node:assert/strict');
const Artwork = require('../models/Artwork');
const Artist = require('../models/Artist');
const { updateArtwork, listArtworks } = require('../controllers/artworkController');

test('custom artwork labels survive edits; empty Others and invalid lists are rejected', async () => {
  const artwork = { categories: ['Painting'], save: async () => {}, toObject() { return { ...this }; } };
  const res = { json() {} };
  const next = (error) => { throw error; };
  await updateArtwork({ artwork, body: { categories: ['Painting', '  Pixel Art  '] } }, res, next);
  assert.deepEqual(artwork.categories, ['Painting', 'Pixel Art']);
  for (const categories of [[], [''], ['Others'], ['  '], ['<script>'], ['https://spam.com'], ['Pixel Art', 'pixel art'], ['x'.repeat(41)], ['Painting', 'Photography', 'Crafts', 'Sculpture', 'Calligraphy', 'Pixel Art']]) {
    await assert.rejects(updateArtwork({ artwork, body: { categories } }, res, next), { status: 400 });
  }
});

test('Others gallery filter selects custom labels alongside standard categories and retains public visibility rules', async (t) => {
  let pipelineFilter; let countFilter;
  t.mock.method(Artwork, 'aggregate', async (pipeline) => { pipelineFilter = pipeline[0].$match; return []; });
  t.mock.method(Artwork, 'countDocuments', async (filter) => { countFilter = filter; return 0; });
  const req = { query: { category: 'Others' }, protocol: 'http', get: () => 'localhost' };
  await listArtworks(req, { set() {}, json() {} }, (error) => { throw error; });
  assert.deepEqual(pipelineFilter, countFilter);
  const known = pipelineFilter.categories.$elemMatch.$nin;
  assert.ok(known.includes('Painting'));
  assert.ok(!known.includes('Pixel Art'));
  assert.equal(pipelineFilter.visibility.$ne, 'private');
  assert.deepEqual(pipelineFilter.reviewStatus.$nin, ['pending', 'rejected']);
  req.query.category = 'Painting';
  await listArtworks(req, { set() {}, json() {} }, (error) => { throw error; });
  assert.equal(pipelineFilter.categories, 'Painting');
});

test('gallery search escapes regex and filters on the server before pagination and total counts', async (t) => {
  let pipeline; let countFilter;
  t.mock.method(Artist, 'find', (filter) => {
    assert.equal(filter.name.$regex.source, 'Pixel\\.\\*');
    return { select: () => ({ limit: () => ({ lean: async () => [{ _id: 'artist-1' }] }) }) };
  });
  t.mock.method(Artwork, 'aggregate', async (value) => { pipeline = value; return []; });
  t.mock.method(Artwork, 'countDocuments', async (filter) => { countFilter = filter; return 25; });
  let response;
  await listArtworks({ query: { search: 'Pixel.*', page: '2', limit: '24' }, protocol: 'http', get: () => 'localhost' }, { set() {}, json(value) { response = value; } }, (err) => { throw err; });
  assert.equal(pipeline[0].$match.$or[0].title.$regex.source, 'Pixel\\.\\*');
  assert.equal(pipeline[2].$skip, 24);
  assert.deepEqual(countFilter, pipeline[0].$match);
  assert.equal(response.total, 25); assert.equal(response.pages, 2);
});

test('gallery rejects selector objects and excessive search strings', async () => {
  for (const query of [{ search: { $where: '1' } }, { search: 'a'.repeat(121) }, { category: { $ne: '' } }]) {
    let code;
    await listArtworks({ query }, { set() {}, status(value) { code = value; return this; }, json() {} }, (err) => { throw err; });
    assert.equal(code, 400);
  }
});
