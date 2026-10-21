const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Grants = require('../models/BackupRecoverySession');
const DURATION = 15 * 24 * 60 * 60 * 1000;
const fingerprint = (token) => `device:${crypto.createHash('sha256').update(token).digest('hex')}`;
async function verify(providerUserId, token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return false;
  return Boolean(await Grants.exists({ providerUserId, sessionId: fingerprint(token), expiresAt: mongoose.trusted({ $gt: new Date() }) }));
}
async function create(providerUserId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + DURATION);
  await Grants.create({ providerUserId, sessionId: fingerprint(token), expiresAt });
  return { token, expiresAt };
}
module.exports = { verify, create };
