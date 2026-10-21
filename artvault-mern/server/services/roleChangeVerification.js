const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Challenge = require('../models/RoleChangeChallenge');
const mailer = require('../config/mailer');
const { securityEmail } = require('../utils/securityEmail');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function hash(actor, target, from, to, code) {
  if (!process.env.JWT_SECRET) throw fail('Security verification is unavailable.', 503);
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${actor}:${target}:${from}:${to}:${code}`).digest('hex');
}
async function send(actor, target, toRole) {
  if (!mailer.emailNotificationsEnabled()) throw fail('Verification email is unavailable. No role was changed.', 503);
  const sentAt = new Date();
  const code = String(crypto.randomInt(0, 100000000)).padStart(8, '0');
  const digest = hash(actor._id, target._id, target.role, toRole, code);
  try {
    const result = await Challenge.findOneAndUpdate({ actor: actor._id, sentAt: mongoose.trusted({ $lte: new Date(Date.now() - 60000) }) }, {
      $set: { target: target._id, fromRole: target.role, toRole, digest, attempts: 0, sentAt, expiresAt: new Date(sentAt.getTime() + 600000) },
    }, { upsert: true, new: true });
    if (!result) throw fail('Wait one minute before requesting another code.', 429);
  } catch (err) { if (err.code === 11000) throw fail('Wait one minute before requesting another code.', 429); throw err; }
  const action = toRole === 'sub_admin' ? 'promote to Sub-admin' : 'revoke Sub-admin access';
  try {
    const result = await mailer.sendEmail({ to: actor.email, subject: 'Verify ArtVault administrator role change', ...securityEmail({ title: 'Confirm administrator access change', message: `You requested to ${action} for ${target.name} (${target.email}). Enter this code in the Main Admin dashboard to confirm.`, code, footer: 'If this was not you, ignore this email and secure your account. No role has changed yet. Never share this code.' }) });
    if (result?.skipped || (Array.isArray(result?.accepted) && !result.accepted.length)) throw new Error('Email rejected');
  } catch {
    await Challenge.deleteOne({ actor: actor._id, digest });
    throw fail('Could not send the verification email. No role was changed.', 503);
  }
}
async function consume(actor, target, toRole, code) {
  if (typeof code !== 'string' || !/^\d{8}$/.test(code)) throw fail('Enter the eight-digit code sent to the Main Admin email.');
  const query = { actor, target: target._id, fromRole: target.role, toRole, expiresAt: mongoose.trusted({ $gt: new Date() }), attempts: mongoose.trusted({ $lt: 5 }) };
  const row = await Challenge.findOneAndUpdate(query, { $inc: { attempts: 1 } }, { new: true }).select('+digest');
  const digest = hash(actor, target._id, target.role, toRole, code);
  if (!row || row.digest !== digest) throw fail('Verification code is incorrect, expired, or exhausted. Request a new code.');
  const result = await Challenge.deleteOne({ _id: row._id, digest, expiresAt: mongoose.trusted({ $gt: new Date() }) });
  if (!result.deletedCount) throw fail('This verification code was already used. Request a new code.', 409);
}
module.exports = { send, consume };
