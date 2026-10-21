const test = require('node:test');
const assert = require('node:assert/strict');
const { analyticsWindow, getAnalytics } = require('../controllers/analyticsController');
const Artwork = require('../models/Artwork');
const Entry = require('../models/SubmitExhibitEntry');
const routes = require('../routes/artworkRoutes');

test('analytics date ranges use Philippine day boundaries and reject invalid or unbounded requests', () => {
  const range = analyticsWindow({}, new Date('2026-10-20T18:00:00Z'));
  assert.equal(range.to, '2026-10-21');
  assert.equal(range.from, '2026-09-22');
  assert.equal(range.end - range.start, 30 * 86400000);
  assert.equal(analyticsWindow({ from: '2026-10-21', to: '2026-10-21' }).start.toISOString(), '2026-10-20T16:00:00.000Z');
  for (const query of [{ from: '2026-02-30' }, { from: { $gt: '' } }, { from: '2026-10-22', to: '2026-10-20' }, { from: '2020-01-01', to: '2026-10-21' }]) assert.throws(() => analyticsWindow(query), { status: 400 });
});

test('analytics computes defined rates, fills zero days and excludes private labels in its category pipeline', async (t) => {
  t.mock.method(Artwork, 'aggregate', async (pipeline) => {
    assert.deepEqual(pipeline[2].$facet.categories[0].$match, { visibility: { $ne: 'private' }, reviewStatus: { $nin: ['pending', 'rejected'] } });
    assert.ok(pipeline[1].$project.image_path === undefined);
    return [{ totals: [{ uploads: 4, artists: ['a', 'b'], pending: 1, rejected: 1 }], trend: [{ _id: '2026-10-21', count: 4 }], categories: [{ _id: 'Pixel Art', count: 2 }], backlog: [{ overSevenDays: 0 }] }];
  });
  t.mock.method(Entry, 'aggregate', async () => [{ _id: 'approved', count: 3 }, { _id: 'denied', count: 1 }, { _id: 'pending', count: 6 }]);
  let result;
  await getAnalytics({ query: { from: '2026-10-20', to: '2026-10-21' } }, { set() {}, json(value) { result = value; } }, (err) => { throw err; });
  assert.equal(result.approvalRate, 75);
  assert.equal(result.activeArtists, 2);
  assert.deepEqual(result.trend, [{ date: '2026-10-20', count: 0 }, { date: '2026-10-21', count: 4 }]);
  assert.deepEqual(result.categories, [{ category: 'Pixel Art', count: 2 }]);
});

test('empty analytics is explicit and only admin reviewers can access the endpoint', async (t) => {
  t.mock.method(Artwork, 'aggregate', async () => []);
  t.mock.method(Entry, 'aggregate', async () => []);
  let result;
  await getAnalytics({ query: {} }, { set() {}, json(value) { result = value; } }, (err) => { throw err; });
  assert.equal(result.approvalRate, null); assert.equal(result.uploads, 0);
  const route = routes.stack.find((layer) => layer.route?.path === '/admin/analytics').route;
  assert.equal(route.stack[0].name, 'requireAuth');
  let status; let allowed = false;
  route.stack[1].handle({ user: { role: 'artist' } }, { status(value) { status = value; return this; }, json() {} }, () => { allowed = true; });
  assert.equal(status, 403); assert.equal(allowed, false);
});
