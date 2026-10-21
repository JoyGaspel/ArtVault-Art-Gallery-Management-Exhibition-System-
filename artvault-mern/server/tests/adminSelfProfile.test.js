const test = require('node:test');
const assert = require('node:assert/strict');
const { updateAdminSelfProfile, getArtist, getArtistAvatar } = require('../controllers/artistController');
const Artist = require('../models/Artist');
const routes = require('../routes/adminProfileRoutes');
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; }, set() {}, end() {} }; }
test('private administrator profile permits self name changes but rejects role and email changes', async () => {
  const user = { role: 'sub_admin', name: 'Old Name', firstName: 'Old', lastName: 'Name', save: async () => {}, toSafeObject() { return { name: this.name }; } };
  const res = response();
  await updateAdminSelfProfile({ user, body: { firstName: 'New', lastName: 'Name' } }, res, (err) => { throw err; });
  assert.equal(res.body.artist.name, 'New Name');
  for (const body of [{ role: 'main_admin' }, { email: 'other@example.com' }, { bio: 'Public bio' }]) {
    const blocked = response(); await updateAdminSelfProfile({ user, body }, blocked, (err) => { throw err; }); assert.equal(blocked.code, 400);
  }
  const route = routes.stack.find((layer) => layer.route?.path === '/me').route;
  assert.equal(route.stack[0].name, 'requireAuth'); assert.equal(route.stack[1].name, 'requireAdmin');
});
test('administrator profile and photo cannot be fetched through public artist URLs', async (t) => {
  t.mock.method(Artist, 'findById', () => ({ select: () => Object.assign(Promise.resolve({ role: 'main_admin' }), { lean: async () => ({ role: 'main_admin', avatar_path: 'private-image' }) }) }));
  for (const handler of [getArtist, getArtistAvatar]) {
    const res = response(); await handler({ params: { id: 'admin' } }, res, (err) => { throw err; }); assert.equal(res.code, 404);
  }
});
