const service = require('../services/backupSecurity');
const { recordAudit } = require('../utils/audit');
const mailer = require('../config/mailer');
const { securityEmail } = require('../utils/securityEmail');

function providerOnly(req, res) {
  res.set('Cache-Control', 'private, no-store');
  if (!req.supabaseUserId) { res.status(403).json({ message: 'Backup security codes require a verified Supabase account.' }); return false; }
  return true;
}
async function getStatus(req, res, next) {
  if (!providerOnly(req, res)) return;
  try { res.json(await service.status(req.user._id)); } catch (err) { next(err); }
}
async function sendOtp(req, res, next) {
  if (!providerOnly(req, res)) return;
  try {
    const timing = await service.requestOtp(req.user._id, req.user.email, req.body.purpose);
    res.json({ message: 'Verification email sent. Check your inbox and spam folder; delivery may take a few minutes.', email: req.user.email, ...timing });
  } catch (err) { next(err); }
}
async function change(req, res, next) {
  if (!providerOnly(req, res)) return;
  if (req.body.purpose === 'generate' && typeof req.authClaims?.session_id !== 'string') return res.status(401).json({ message: 'Sign in again before enabling backup codes.' });
  try {
    const result = await service.applyChange(req.user._id, req.body.purpose, req.body.otp, req.authClaims?.session_id);
    recordAudit({ req, action: 'update', entityType: 'artist', entityId: req.user._id, details: { backupCodes: req.body.purpose } });
    mailer.sendEmail({ to: req.user.email, subject: 'ArtVault backup security codes changed', ...securityEmail({ title: 'Backup security codes updated', message: `Your backup security codes were ${result.enabled ? 'generated or replaced. Previous codes no longer work' : 'disabled. Unused codes no longer work'}.`, footer: 'If this was not you, secure your account and contact your administrator. Your actual backup codes are never included in this email.' }) }).catch(() => console.error('Backup security change notice could not be sent.'));
    res.json(result);
  } catch (err) { next(err); }
}
async function recover(req, res, next) {
  if (!providerOnly(req, res)) return;
  try {
    const result = await service.redeem(req.user._id, req.supabaseUserId, req.authClaims?.session_id, req.body.code);
    recordAudit({ req, action: 'update', entityType: 'artist', entityId: req.user._id, details: { backupCodeRecovery: true } });
    res.json({ message: 'Backup code accepted. This ArtVault session is verified for 15 minutes.', ...result });
  } catch (err) { next(err); }
}
module.exports = { getStatus, sendOtp, change, recover };
