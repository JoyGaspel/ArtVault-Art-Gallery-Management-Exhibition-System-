const crypto = require('node:crypto');
const mongoose = require('mongoose');
const State = require('../models/BackupSecurity');
const Grants = require('../models/BackupRecoverySession');
const mailer = require('../config/mailer');
const { securityEmail } = require('../utils/securityEmail');
const trust = mongoose.trusted;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function digest(user, purpose, value) {
  if (!process.env.JWT_SECRET) throw fail('Backup code security is not configured.', 503);
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${user}:${purpose}:${value}`).digest('hex');
}
function normalizeCode(value) {
  return typeof value === 'string' ? value.replace(/[\s-]/g, '').toLowerCase() : '';
}
function makeCodes(user) {
  const codes = Array.from({ length: 10 }, () => crypto.randomBytes(10).toString('hex').match(/.{5}/g).join('-'));
  return { codes, hashes: codes.map((code) => digest(user, 'backup', normalizeCode(code))) };
}
function sameDigest(left, right) {
  return typeof left === 'string' && typeof right === 'string' && left.length === right.length
    && crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
async function status(user) {
  const row = await State.findOne({ user }).select('enabled +hashes').lean();
  return { enabled: Boolean(row?.enabled), remaining: row?.enabled ? row.hashes.length : 0 };
}
async function requestOtp(user, email, purpose) {
  if (!['generate', 'disable'].includes(purpose)) throw fail('Choose generate or disable.');
  if (!mailer.emailNotificationsEnabled()) throw fail('Email verification is unavailable. Backup codes were not changed.', 503);
  try { await State.updateOne({ user }, { $setOnInsert: { user } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  const now = new Date();
  const code = String(crypto.randomInt(0, 100000000)).padStart(8, '0');
  const otpHash = digest(user, purpose, code);
  const claimed = await State.findOneAndUpdate({ user, $or: [{ otpSentAt: null }, { otpSentAt: trust({ $lte: new Date(now.getTime() - 60000) }) }] }, {
    $set: { otpHash, otpPurpose: purpose, otpExpiresAt: new Date(now.getTime() + 10 * 60000), otpSentAt: now, otpAttempts: 0 },
  }, { new: true });
  if (!claimed) throw fail('Wait one minute before requesting another verification email.', 429);
  try {
    const label = purpose === 'generate' ? 'generate or replace backup security codes' : 'disable backup security codes';
    const result = await mailer.sendEmail({ to: email, subject: 'ArtVault backup security verification',
      ...securityEmail({ title: 'Verify your backup-code change', message: `Enter this code in ArtVault to ${label}.`, code,
        footer: 'Do not share this code. If you did not request this change, ignore this email; your backup codes have not been changed.' }),
    });
    if (result?.skipped || (Array.isArray(result?.accepted) && result.accepted.length === 0)) throw new Error('Email unavailable');
  } catch {
    await State.updateOne({ user, otpHash }, { $set: { otpHash: '', otpExpiresAt: null, otpSentAt: null } });
    throw fail('Could not send the verification email. Backup codes were not changed.', 503);
  }
  return { expiresAt: new Date(now.getTime() + 10 * 60000).toISOString(), resendAfterSeconds: 60 };
}
async function applyChange(user, purpose, otp, sessionId = '') {
  if (!['generate', 'disable'].includes(purpose) || typeof otp !== 'string' || !/^\d{8}$/.test(otp)) throw fail('Enter the eight-digit email verification code.');
  // Claim an attempt atomically before comparison. Invalid attempts are bounded.
  const row = await State.findOneAndUpdate({ user, otpPurpose: purpose, otpExpiresAt: trust({ $gt: new Date() }), otpAttempts: trust({ $lt: 5 }), otpHash: trust({ $ne: '' }) }, { $inc: { otpAttempts: 1 } }, { new: true }).select('+otpHash');
  if (!row || !sameDigest(row.otpHash, digest(user, purpose, otp))) throw fail('Verification code is invalid, expired, or exhausted. Request a new email.');
  const generated = purpose === 'generate' ? makeCodes(user) : { codes: [], hashes: [] };
  // Exact challenge hash + expiry ensures concurrent/replayed requests cannot reuse OTP.
  const changed = await State.findOneAndUpdate({ user, otpHash: row.otpHash, otpPurpose: purpose, otpExpiresAt: trust({ $gt: new Date() }) }, {
    $set: { enabled: purpose === 'generate', hashes: generated.hashes, otpHash: '', otpPurpose: '', otpExpiresAt: null, otpAttempts: 0, failedRecoveries: 0, recoveryLockedUntil: null,
      verifiedSessionId: purpose === 'generate' ? sessionId : '',
      verifiedSessionExpiresAt: purpose === 'generate' && sessionId ? new Date(Date.now() + 15 * 60000) : null,
    },
  }, { new: true });
  if (!changed) throw fail('This verification code was already used or expired. Request a new email.', 409);
  return { enabled: purpose === 'generate', remaining: generated.codes.length, ...(purpose === 'generate' ? { codes: generated.codes } : {}) };
}
async function redeem(user, providerUserId, sessionId, code) {
  if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 200) throw fail('Sign in again before using a backup code.', 401);
  if (typeof code !== 'string' || code.length > 64) throw fail('Enter a valid backup security code.');
  const normalized = normalizeCode(code);
  if (!/^[a-f0-9]{20}$/.test(normalized)) throw fail('Enter a valid backup security code.');
  const now = new Date();
  await State.updateOne({ user, recoveryLockedUntil: trust({ $ne: null, $lte: now }) }, { $set: { failedRecoveries: 0, recoveryLockedUntil: null } });
  const row = await State.findOneAndUpdate({ user, enabled: true, recoveryLockedUntil: null, failedRecoveries: trust({ $lt: 5 }) }, { $inc: { failedRecoveries: 1 } }, { new: true });
  if (!row) throw fail('Backup recovery unavailable or temporarily locked. Use your authenticator or try again later.', 429);
  const hash = digest(user, 'backup', normalized);
  const used = await State.findOneAndUpdate({ user, enabled: true, hashes: hash, recoveryLockedUntil: null }, { $pull: { hashes: hash }, $set: { failedRecoveries: 0 } }, { new: true });
  if (!used) {
    await State.updateOne({ user, failedRecoveries: trust({ $gte: 5 }) }, { $set: { recoveryLockedUntil: new Date(now.getTime() + 15 * 60000) } });
    throw fail('Backup code is invalid or already used.');
  }
  const expiresAt = new Date(now.getTime() + 15 * 60000);
  await Grants.updateOne({ providerUserId, sessionId }, { $set: { expiresAt } }, { upsert: true });
  return { expiresAt };
}
module.exports = { digest, normalizeCode, makeCodes, sameDigest, status, requestOtp, applyChange, redeem };
