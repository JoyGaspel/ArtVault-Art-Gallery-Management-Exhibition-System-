const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../services/backupSecurity');
const State = require('../models/BackupSecurity');
const Grants = require('../models/BackupRecoverySession');
const mailer = require('../config/mailer');

function secret(t) {
  const old = process.env.JWT_SECRET; process.env.JWT_SECRET = 'a-test-only-secret-for-backup-codes';
  t.after(() => { if (old === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = old; });
}

test('backup codes have strong random values and only purpose/account-bound digests are stored', (t) => {
  secret(t);
  const { codes, hashes } = service.makeCodes('user');
  assert.equal(codes.length, 10); assert.equal(new Set(codes).size, 10);
  assert.ok(codes.every((code) => /^[a-f0-9]{5}(-[a-f0-9]{5}){3}$/.test(code)));
  assert.ok(hashes.every((hash) => /^[a-f0-9]{64}$/.test(hash)));
  assert.equal(hashes[0], service.digest('user', 'backup', service.normalizeCode(codes[0].toUpperCase())));
  assert.notEqual(hashes[0], service.digest('other-user', 'backup', service.normalizeCode(codes[0])));
  assert.notEqual(service.digest('user', 'generate', '12345678'), service.digest('user', 'disable', '12345678'));
});

test('email OTP delivery failure invalidates challenge and never enables or disables codes', async (t) => {
  secret(t);
  t.mock.method(mailer, 'emailNotificationsEnabled', () => true);
  const updates = [];
  t.mock.method(State, 'updateOne', async (filter, update) => { updates.push({ filter, update }); });
  t.mock.method(State, 'findOneAndUpdate', async (filter, update) => {
    assert.equal(filter.$or[1].otpSentAt.$lte instanceof Date, true);
    assert.equal(update.$set.enabled, undefined);
    assert.equal(update.$set.otpHash.length, 64);
    assert.equal(update.$set.otpExpiresAt - update.$set.otpSentAt, 10 * 60000);
    return {};
  });
  t.mock.method(mailer, 'sendEmail', async () => { throw new Error('SMTP down'); });
  await assert.rejects(service.requestOtp('user', 'registered@example.com', 'generate'), { status: 503 });
  assert.equal(updates.at(-1).update.$set.otpHash, '');
  assert.ok(updates.every(({ update }) => update.$set?.enabled === undefined));
});

test('email request reports expiry only after transport acceptance and rejects an empty accepted list', async (t) => {
  secret(t);
  t.mock.method(mailer, 'emailNotificationsEnabled', () => true);
  t.mock.method(State, 'updateOne', async () => ({}));
  t.mock.method(State, 'findOneAndUpdate', async () => ({}));
  const send = t.mock.method(mailer, 'sendEmail', async () => ({ accepted: ['registered@example.com'] }));
  const result = await service.requestOtp('user', 'registered@example.com', 'generate');
  assert.equal(result.resendAfterSeconds, 60);
  assert.ok(new Date(result.expiresAt).getTime() > Date.now());
  send.mock.mockImplementation(async () => ({ accepted: [], rejected: ['registered@example.com'] }));
  await assert.rejects(service.requestOtp('user', 'registered@example.com', 'generate'), { status: 503 });
});

test('OTP cooldown and exhausted or incorrect challenges fail without changing backup codes', async (t) => {
  secret(t);
  t.mock.method(mailer, 'emailNotificationsEnabled', () => true);
  t.mock.method(State, 'updateOne', async () => ({}));
  const query = t.mock.method(State, 'findOneAndUpdate', () => Promise.resolve(null));
  await assert.rejects(service.requestOtp('user', 'registered@example.com', 'disable'), { status: 429 });
  query.mock.mockImplementation((filter, update) => {
    assert.equal(filter.otpAttempts.$lt, 5);
    assert.equal(update.$inc.otpAttempts, 1);
    return { select: async () => null };
  });
  await assert.rejects(service.applyChange('user', 'generate', '12345678'), { status: 400 });
  query.mock.mockImplementation(() => ({ select: async () => ({ otpHash: service.digest('user', 'disable', '12345678') }) }));
  await assert.rejects(service.applyChange('user', 'generate', '12345678'), { status: 400 });
});

test('valid OTP rotates codes once; replay and cross-purpose use cannot repeat the change', async (t) => {
  secret(t);
  const challenge = service.digest('user', 'generate', '12345678');
  let consumed = false;
  t.mock.method(State, 'findOneAndUpdate', (filter, update) => {
    if (update.$inc) return { select: async () => consumed ? null : { otpHash: challenge } };
    assert.equal(filter.otpHash, challenge);
    assert.equal(filter.otpPurpose, 'generate');
    assert.ok(filter.otpExpiresAt.$gt instanceof Date);
    assert.equal(update.$set.enabled, true);
    assert.equal(update.$set.hashes.length, 10);
    assert.equal(update.$set.otpHash, '');
    assert.equal(update.$set.verifiedSessionId, 'setup-session');
    assert.ok(update.$set.verifiedSessionExpiresAt instanceof Date);
    consumed = true; return Promise.resolve({});
  });
  const result = await service.applyChange('user', 'generate', '12345678', 'setup-session');
  assert.equal(result.codes.length, 10); assert.equal(result.remaining, 10);
  await assert.rejects(service.applyChange('user', 'generate', '12345678'), { status: 400 });
});

test('backup-code setup accepts a verified account without an authenticator', async (t) => {
  const controller = require('../controllers/backupSecurityController');
  const request = t.mock.method(service, 'requestOtp', async () => {});
  const change = t.mock.method(service, 'applyChange', async (_user, _purpose, otp, session) => {
    assert.equal(otp, '12345678'); assert.equal(session, 'setup-session');
    return { enabled: true, remaining: 10, codes: [] };
  });
  t.mock.method(mailer, 'sendEmail', async () => ({}));
  const req = { supabaseUserId: 'provider', providerFactors: [], authClaims: { session_id: 'setup-session' }, user: { email: 'test@example.com' }, body: { purpose: 'generate', otp: '12345678' } };
  const res = { set() {}, json() {}, status() { throw new Error('No authenticator should be required'); } };
  await controller.sendOtp(req, res, (err) => { throw err; });
  await controller.change(req, res, (err) => { throw err; });
  assert.equal(request.mock.callCount(), 1); assert.equal(change.mock.callCount(), 1);
});

test('disable also needs a valid purpose-bound OTP and removes all hashes', async (t) => {
  secret(t);
  t.mock.method(State, 'findOneAndUpdate', (filter, update) => {
    if (update.$inc) return { select: async () => ({ otpHash: service.digest('user', 'disable', '87654321') }) };
    assert.equal(filter.otpPurpose, 'disable');
    assert.equal(update.$set.enabled, false); assert.deepEqual(update.$set.hashes, []);
    return Promise.resolve({});
  });
  assert.deepEqual(await service.applyChange('user', 'disable', '87654321'), { enabled: false, remaining: 0 });
});

test('redemption consumes a backup code atomically and binds recovery to the verified provider session', async (t) => {
  secret(t);
  t.mock.method(State, 'updateOne', async () => ({}));
  let consumed = false; let grants = 0;
  t.mock.method(State, 'findOneAndUpdate', async (filter, update) => {
    if (update.$inc) return { failedRecoveries: 1 };
    assert.equal(filter.hashes, service.digest('user', 'backup', 'abcdeabcdeabcdeabcde'));
    assert.equal(update.$pull.hashes, filter.hashes);
    if (consumed) return null;
    consumed = true; return {};
  });
  t.mock.method(Grants, 'updateOne', async (filter, update) => {
    grants++;
    assert.deepEqual(filter, { providerUserId: 'provider-user', sessionId: 'session-a' });
    assert.ok(update.$set.expiresAt.getTime() - Date.now() <= 15 * 60000);
  });
  const results = await Promise.allSettled([
    service.redeem('user', 'provider-user', 'session-a', 'ABCDE-ABCDE-ABCDE-ABCDE'),
    service.redeem('user', 'provider-user', 'session-a', 'ABCDE-ABCDE-ABCDE-ABCDE'),
  ]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(grants, 1);
  await assert.rejects(service.redeem('user', 'provider-user', '', 'abcdeabcdeabcdeabcde'), { status: 401 });
});

test('locked recovery cannot consume a code or create a session grant', async (t) => {
  secret(t);
  t.mock.method(State, 'updateOne', async () => ({}));
  t.mock.method(State, 'findOneAndUpdate', async () => null);
  const grant = t.mock.method(Grants, 'updateOne', async () => { throw new Error('Must not grant access'); });
  await assert.rejects(service.redeem('user', 'provider', 'session', 'abcdeabcdeabcdeabcde'), { status: 429 });
  assert.equal(grant.mock.callCount(), 0);
});
