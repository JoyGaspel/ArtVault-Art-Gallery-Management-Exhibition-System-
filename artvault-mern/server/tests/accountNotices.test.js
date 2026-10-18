const test = require('node:test');
const assert = require('node:assert/strict');
const mailer = require('../config/mailer');
const { sendAccountNoticeInBackground } = require('../services/accountNoticeService');

test('account changes send the matching transactional notice', async (t) => {
  const sent = [];
  t.mock.method(mailer, 'sendEmail', async (message) => { sent.push(message); return { accepted: [message.to] }; });
  for (const type of ['suspended', 'active', 'deletion_requested', 'removed', 'permanently_deleted']) {
    const result = await sendAccountNoticeInBackground('artist@example.com', type);
    assert.deepEqual(result.accepted, ['artist@example.com']);
  }
  assert.equal(sent.length, 5);
  assert.equal(new Set(sent.map((message) => message.subject)).size, 5);
  assert.ok(sent.every((message) => message.to === 'artist@example.com' && message.text && message.html));
  assert.match(sent[2].text, /not yet permanent deletion/i);
});

test('missing recipients and unknown notice types do not send email', async (t) => {
  t.mock.method(mailer, 'sendEmail', () => { throw new Error('Email should not be sent.'); });
  assert.deepEqual(await sendAccountNoticeInBackground('', 'suspended'), { skipped: true });
  assert.deepEqual(await sendAccountNoticeInBackground('artist@example.com', 'unknown'), { skipped: true });
});

test('a mail transport failure is handled without failing the account action', async (t) => {
  t.mock.method(mailer, 'sendEmail', async () => { throw new Error('SMTP unavailable'); });
  t.mock.method(console, 'error', () => {});
  assert.deepEqual(await sendAccountNoticeInBackground('artist@example.com', 'suspended'), { failed: true });
});
