const test = require('node:test');
const assert = require('node:assert/strict');
const likeRoutes = require('../routes/likeRoutes');
const artistRoutes = require('../routes/artistRoutes');
const { updateMyProfile } = require('../controllers/artistController');
const { createArtwork } = require('../controllers/artworkController');
const { signup } = require('../controllers/authController');

function response() {
  return {
    code: 200,
    body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('the artwork-like monitoring endpoint is main-admin only', () => {
  const route = likeRoutes.stack.find((layer) => layer.route?.path === '/likes' && layer.route.methods.get);
  assert.ok(route);
  for (const role of ['artist', 'sub_admin', 'admin']) {
    const res = response();
    let allowed = false;
    route.route.stack[1].handle({ user: { role } }, res, () => { allowed = true; });
    assert.equal(allowed, false);
    assert.equal(res.code, 403);
  }
  let allowed = false;
  route.route.stack[1].handle({ user: { role: 'main_admin' } }, response(), () => { allowed = true; });
  assert.equal(allowed, true);
});

test('administrators cannot edit their own public profile through the artist endpoint', async () => {
  for (const role of ['admin', 'sub_admin', 'main_admin']) {
    const res = response();
    await updateMyProfile({ user: { role }, body: { name: 'Changed' } }, res, (error) => { throw error; });
    assert.equal(res.code, 403);
  }
});

test('administrator directory cannot edit artist profiles, while owner editing remains available', () => {
  assert.equal(artistRoutes.stack.some((layer) => layer.route?.path === '/admin/:id' && layer.route.methods.put), false);
  assert.equal(artistRoutes.stack.some((layer) => layer.route?.path === '/me' && layer.route.methods.put), true);
});

test('signup rejects requests without accepted terms before creating an account', async () => {
  const res = response();
  await signup({ body: { name: 'Test Artist', email: 'artist@example.com', password: 'password123' } }, res, (error) => { throw error; });
  assert.equal(res.code, 400);
  assert.match(res.body.message, /Terms and Conditions/);
});

test('artwork upload rejects missing or oversized category lists before database writes', async () => {
  for (const categories of [[], Array(6).fill('Digital Art'), [''], ['Not a real category']]) {
    const res = response();
    let validationError = null;
    await createArtwork({ user: { role: 'artist' }, body: { title: 'Test work', categories } }, res, (error) => { validationError = error; });
    assert.equal(validationError?.status, 400);
  }
});
