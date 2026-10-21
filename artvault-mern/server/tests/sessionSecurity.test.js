const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { tokenHash, needsMfa } = require('../utils/sessionSecurity');
const Artist = require('../models/Artist');
const Revoked = require('../models/RevokedSession');
const Recovery = require('../models/BackupRecoverySession');
const Backup = require('../models/BackupSecurity');
const configPath = require.resolve('../config/supabase');
let providerUser;
require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: { auth: { getUser: async () => providerUser ? { data: { user: providerUser }, error: null } : { data: {}, error: new Error('Not a provider token') } } } };
const { requireAuth } = require('../middleware/auth');
function response() { return { code: 200, status(value) { this.code = value; return this; }, json(value) { this.body = value; } }; }

test('backup-only accounts require a code without TOTP and accept their OTP-verified setup session', async (t) => {
  t.mock.method(Revoked, 'exists', async () => false);
  providerUser = { id: 'provider', email: 'member@example.com', email_confirmed_at: '2026-10-21T00:00:00Z', factors: [] };
  t.after(() => { providerUser = null; });
  const profile = { _id: 'user', supabaseUserId: 'provider', email: providerUser.email, role: 'artist', save: async () => {} };
  t.mock.method(Artist, 'findOne', () => ({ select: async () => profile }));
  let setupVerified = false; let codeVerified = false;
  t.mock.method(Backup, 'exists', async (filter) => {
    if (!filter.verifiedSessionId) return true;
    assert.equal(filter.verifiedSessionId, 'session');
    assert.ok(filter.verifiedSessionExpiresAt.$gt instanceof Date);
    return setupVerified;
  });
  t.mock.method(Recovery, 'exists', async () => codeVerified);
  const req = { headers: { authorization: `Bearer ${jwt.sign({ aal: 'aal1', session_id: 'session' }, 'test')}` } };
  let allowed = false;
  const res = response(); await requireAuth(req, res, () => { allowed = true; });
  assert.equal(res.body.code, 'MFA_REQUIRED'); assert.equal(allowed, false);
  setupVerified = true;
  await requireAuth(req, response(), () => { allowed = true; }); assert.equal(allowed, true);
  setupVerified = false; codeVerified = true; allowed = false;
  await requireAuth(req, response(), () => { allowed = true; }); assert.equal(allowed, true);
});

test('MFA requires a verified factor and verified aal2; revocation identifiers do not expose tokens', () => {
  assert.equal(Boolean(needsMfa({ factors: [] }, { aal: 'aal1' })), false);
  assert.equal(needsMfa({ factors: [{ status: 'verified' }] }, { aal: 'aal1' }), true);
  assert.equal(needsMfa({ factors: [{ status: 'verified' }] }, { aal: 'aal2' }), false);
  assert.equal(tokenHash('secret-token').length, 64);
  assert.notEqual(tokenHash('secret-token'), tokenHash('another-token'));
});

test('protected API rejects revoked tokens and password-only sessions with enrolled MFA', async (t) => {
  const revoked = t.mock.method(Revoked, 'exists', async () => true);
  let next = false; const res = response();
  await requireAuth({ headers: { authorization: 'Bearer revoked' } }, res, () => { next = true; });
  assert.equal(res.code, 401); assert.equal(next, false);
  revoked.mock.mockImplementation(async () => false);
  providerUser = { factors: [{ status: 'verified' }] };
  const token = jwt.sign({ aal: 'aal1' }, 'test');
  const challenge = response();
  await requireAuth({ headers: { authorization: `Bearer ${token}` } }, challenge, () => { next = true; });
  assert.equal(challenge.code, 403); assert.equal(challenge.body.code, 'MFA_REQUIRED'); assert.equal(next, false);
  providerUser = null;
});

test('legacy tokens cannot bypass provider authentication or access a removed profile', async (t) => {
  t.mock.method(Revoked, 'exists', async () => false);
  providerUser = null;
  const secret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'test-secret';
  t.after(() => { if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; });
  let profile = { supabaseUserId: 'linked-user' };
  t.mock.method(Artist, 'findById', () => ({ select: async () => profile }));
  const req = { headers: { authorization: `Bearer ${jwt.sign({ sub: 'user' }, 'test-secret')}` } };
  let allowed = false;
  const linked = response(); await requireAuth(req, linked, () => { allowed = true; });
  assert.equal(linked.code, 401); assert.equal(allowed, false);
  profile = { removed: true };
  const removed = response(); await requireAuth(req, removed, () => { allowed = true; });
  assert.equal(removed.code, 423); assert.equal(allowed, false);
});

test('verified provider aal2 session passes backend MFA checks and receives its database role', async (t) => {
  t.mock.method(Revoked, 'exists', async () => false);
  providerUser = { id: 'provider-id', email: 'member@example.com', email_confirmed_at: '2026-10-21T00:00:00Z', factors: [{ status: 'verified' }] };
  t.after(() => { providerUser = null; });
  const profile = { supabaseUserId: 'provider-id', email: providerUser.email, name: 'Member', role: 'artist', save: async () => {} };
  t.mock.method(Artist, 'findOne', () => ({ select: async () => profile }));
  const req = { headers: { authorization: `Bearer ${jwt.sign({ aal: 'aal2' }, 'test')}` } };
  let allowed = false;
  await requireAuth(req, response(), () => { allowed = true; });
  assert.equal(allowed, true); assert.equal(req.user.role, 'artist');
});

test('logout persists only a hash and expiry through an authenticated route', async (t) => {
  const routes = require('../routes/authRoutes');
  const route = routes.stack.find((layer) => layer.route?.path === '/logout').route;
  assert.equal(route.stack[0].name, 'requireAuth');
  const token = jwt.sign({ sub: 'user' }, 'test', { expiresIn: '30m' });
  t.mock.method(Revoked, 'updateOne', async (filter, update, options) => {
    assert.equal(filter.tokenHash, tokenHash(token));
    assert.equal(update.$setOnInsert.expiresAt.getTime(), jwt.decode(token).exp * 1000);
    assert.equal(options.upsert, true);
  });
  const res = { set() {}, json() {} };
  await route.stack.at(-1).handle({ authToken: token }, res, (err) => { throw err; });
});

test('backup recovery is session-bound and time-limited; pending MFA access is limited to redemption', async (t) => {
  t.mock.method(Revoked, 'exists', async () => false);
  providerUser = { id: 'provider-id', email: 'member@example.com', email_confirmed_at: '2026-10-21T00:00:00Z', factors: [{ status: 'verified', factor_type: 'totp' }] };
  t.after(() => { providerUser = null; });
  const profile = { _id: 'user', supabaseUserId: 'provider-id', email: providerUser.email, name: 'Member', role: 'artist', save: async () => {} };
  t.mock.method(Artist, 'findOne', () => ({ select: async () => profile }));
  let hasGrant = false;
  t.mock.method(Recovery, 'exists', async (filter) => {
    assert.equal(filter.providerUserId, 'provider-id'); assert.equal(filter.sessionId, 'session-a');
    assert.ok(filter.expiresAt.$gt instanceof Date);
    return hasGrant;
  });
  const req = { headers: { authorization: `Bearer ${jwt.sign({ aal: 'aal1', session_id: 'session-a' }, 'test')}` } };
  let allowed = false;
  const blocked = response(); await requireAuth(req, blocked, () => { allowed = true; });
  assert.equal(blocked.code, 403); assert.equal(allowed, false);
  const { requireRecoveryAuth } = require('../middleware/auth');
  await requireRecoveryAuth(req, response(), () => { allowed = true; });
  assert.equal(allowed, true);
  hasGrant = true; allowed = false;
  await requireAuth(req, response(), () => { allowed = true; });
  assert.equal(allowed, true);
  const routes = require('../routes/authRoutes');
  for (const path of ['/backup-codes', '/backup-codes/otp', '/backup-codes/change']) {
    const route = routes.stack.find((layer) => layer.route?.path === path).route;
    assert.equal(route.stack[0].name, 'requireAuth');
  }
  assert.equal(routes.stack.find((layer) => layer.route?.path === '/backup-codes/redeem').route.stack[0].name, 'requireRecoveryAuth');
});
