const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../services/roleChangeVerification');
const Challenge = require('../models/RoleChangeChallenge');
const mailer = require('../config/mailer');
const { setArtistRole, requestRoleChangeOtp } = require('../controllers/artistController');
const Artist = require('../models/Artist');
const actor = { _id: 'actor', email: 'owner@example.com', role: 'main_admin' };
const target = { _id: 'target', email: 'artist@example.com', name: 'Artist', role: 'artist' };
test('role OTP is emailed only to Main Admin, bound to target/action, expires and is single-use', async (t) => {
  const old = process.env.JWT_SECRET; process.env.JWT_SECRET = 'test-only';
  t.after(() => { if (old === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = old; });
  let stored; let code;
  t.mock.method(mailer, 'emailNotificationsEnabled', () => true);
  t.mock.method(Challenge, 'findOneAndUpdate', (_filter, update) => {
    if (update.$set) { stored = update.$set; return Promise.resolve({}); }
    return { select: async () => ({ _id: 'challenge', digest: stored.digest }) };
  });
  t.mock.method(mailer, 'sendEmail', async (email) => { assert.equal(email.to, actor.email); code = email.text.match(/code: (\d{8})/)[1]; return { accepted: [actor.email] }; });
  await service.send(actor, target, 'sub_admin');
  assert.equal(stored.toRole, 'sub_admin'); assert.equal(stored.target, target._id);
  assert.ok(stored.expiresAt - stored.sentAt <= 600001);
  let consumed = false;
  t.mock.method(Challenge, 'deleteOne', async () => { if (consumed) return { deletedCount: 0 }; consumed = true; return { deletedCount: 1 }; });
  await assert.rejects(service.consume(actor._id, target, 'artist', code), { status: 400 });
  await assert.rejects(service.consume(actor._id, { ...target, _id: 'other' }, 'sub_admin', code), { status: 400 });
  await service.consume(actor._id, target, 'sub_admin', code);
  await assert.rejects(service.consume(actor._id, target, 'sub_admin', code), { status: 409 });
});
test('role endpoints deny sub-admins and require confirmation before any mutation', async (t) => {
  const res = () => ({ code: 200, status(value) { this.code = value; return this; }, json() {} });
  for (const fn of [setArtistRole, requestRoleChangeOtp]) {
    const result = res(); await fn({ user: { role: 'sub_admin' }, body: {} }, result, (err) => { throw err; }); assert.equal(result.code, 403);
  }
  t.mock.method(Artist, 'findOne', () => ({ select: async () => target }));
  const update = t.mock.method(Artist, 'updateOne', async () => { throw new Error('Must not mutate'); });
  const result = res(); await setArtistRole({ user: actor, params: { id: target._id }, body: { role: 'sub_admin' } }, result, (err) => { throw err; });
  assert.equal(result.code, 400); assert.equal(update.mock.callCount(), 0);
});
