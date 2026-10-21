const { test } = require('node:test');
const assert = require('node:assert/strict');
const Grants = require('../models/BackupRecoverySession');
const devices = require('../services/trustedMfaDevice');
test('remembered MFA uses random tokens, hashed storage, and a fixed fifteen-day expiry', async (t) => {
  let record;
  t.mock.method(Grants, 'create', async (row) => { record = row; });
  const start = Date.now();
  const result = await devices.create('account-a');
  assert.match(result.token, /^[a-f0-9]{64}$/);
  assert.notEqual(record.sessionId, result.token);
  assert.equal(record.providerUserId, 'account-a');
  assert.ok(record.expiresAt.getTime() >= start + 15 * 86400000);
  assert.ok(record.expiresAt.getTime() <= Date.now() + 15 * 86400000);
  t.mock.method(Grants, 'exists', async (filter) => {
    assert.equal(filter.providerUserId, 'account-a');
    assert.equal(filter.sessionId, record.sessionId);
    assert.ok(filter.expiresAt.$gt instanceof Date);
    return null;
  });
  assert.equal(await devices.verify('account-a', result.token), false);
  assert.equal(await devices.verify('account-a', 'invalid'), false);
});
