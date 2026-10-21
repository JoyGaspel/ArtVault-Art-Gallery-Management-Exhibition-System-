const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Artist = require('../models/Artist');
const Archive = require('../models/Archive');
const supabase = require('../config/supabase');
const RevokedSession = require('../models/RevokedSession');
const { tokenHash, needsMfa } = require('../utils/sessionSecurity');
const BackupRecoverySession = require('../models/BackupRecoverySession');
const mongoose = require('mongoose');
const BackupSecurity = require('../models/BackupSecurity');

async function mirrorSupabaseUser(authUser) {
  if (!authUser?.email || !authUser.email_confirmed_at) return null;

  // A removed Supabase identity may still authenticate. Do not silently
  // recreate its Mongo profile until an administrator restores the archive.
  let user = await Artist.findOne({ supabaseUserId: authUser.id }).select('+supabaseUserId');
  if (!user) user = await Artist.findOne({ email: authUser.email.toLowerCase() });

  if (!user) {
    const removedAccount = await Archive.exists({ entityType: 'artist', 'snapshot.email': authUser.email.toLowerCase() });
    if (removedAccount) return { removed: true };
  }

  if (!user) {
    user = new Artist({
      name: authUser.user_metadata?.name || authUser.email.split('@')[0],
      firstName: authUser.user_metadata?.firstName || '',
      lastName: authUser.user_metadata?.lastName || '',
      extensionName: authUser.user_metadata?.extensionName || '',
      email: authUser.email,
      // Supabase owns the password; this unusable random value satisfies the legacy schema.
      password: crypto.randomBytes(32).toString('hex'),
      role: 'artist',
      specializations: authUser.user_metadata?.specializations || [],
      bio: authUser.user_metadata?.bio || '',
      supabaseUserId: authUser.id,
      emailConfirmedAt: authUser.email_confirmed_at ? new Date(authUser.email_confirmed_at) : null,
      termsVersion: authUser.user_metadata?.termsVersion || '',
      termsAcceptedAt: authUser.user_metadata?.termsAcceptedAt || null,
    });
  } else if (!user.supabaseUserId) {
    user.supabaseUserId = authUser.id;
  }

  user.emailConfirmedAt = authUser.email_confirmed_at ? new Date(authUser.email_confirmed_at) : null;

  // Backfill profile data for users created before Supabase sync was enabled.
  const metadata = authUser.user_metadata || {};
  if (!user.firstName && metadata.firstName) user.firstName = metadata.firstName;
  if (!user.lastName && metadata.lastName) user.lastName = metadata.lastName;
  if (!user.extensionName && metadata.extensionName) user.extensionName = metadata.extensionName;
  if ((!user.name || user.name === authUser.email) && metadata.name) user.name = metadata.name;
  if (!user.bio && metadata.bio) user.bio = metadata.bio;
  if ((!user.specializations || !user.specializations.length) && Array.isArray(metadata.specializations)) user.specializations = metadata.specializations;
  if (!user.termsAcceptedAt && metadata.termsAcceptedAt) {
    user.termsVersion = metadata.termsVersion || '';
    user.termsAcceptedAt = new Date(metadata.termsAcceptedAt);
  }

  // Preserve the designated owner account as the main administrator.
  const mainAdminEmail = (process.env.MAIN_ADMIN_EMAIL || '').trim().toLowerCase();
  if (mainAdminEmail && authUser.email.toLowerCase() === mainAdminEmail) {
    user.role = 'main_admin';
  }

  await user.save();
  return user;
}

/** Verifies Supabase Auth tokens, mirrors verified users into MongoDB, and
 * retains legacy JWT support while the migration is in progress. */
async function authenticate(req, res, next, allowMfaPending = false) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Sign in required for this action.' });

  try {
    if (await RevokedSession.exists({ tokenHash: tokenHash(token) })) return res.status(401).json({ message: 'This session has been signed out. Sign in again.' });
    req.authToken = token;
    if (supabase) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user) {
        // Claims are used only after Supabase verifies the token with getUser.
        const claims = jwt.decode(token);
        const remembered = await require('../services/trustedMfaDevice').verify(data.user.id, req.headers['x-artvault-mfa-device']);
        req.rememberedMfaDevice = remembered;
        if (needsMfa(data.user, claims) && !allowMfaPending) {
          const recovered = typeof claims?.session_id === 'string' && await BackupRecoverySession.exists({ providerUserId: data.user.id, sessionId: claims.session_id, expiresAt: mongoose.trusted({ $gt: new Date() }) });
          if (!recovered && !remembered) return res.status(403).json({ code: 'MFA_REQUIRED', message: 'Complete authenticator verification to continue.' });
        }
        if (!data.user.email_confirmed_at) {
          return res.status(403).json({ message: 'Please confirm your email before continuing.' });
        }
        let user;
        try {
          user = await mirrorSupabaseUser(data.user);
        } catch (mirrorError) {
          console.error('Supabase-to-Mongo user sync failed:', mirrorError);
          if (process.env.NODE_ENV !== 'production') {
            return res.status(500).json({ message: `Could not sync your account: ${mirrorError.message}` });
          }
          return res.status(500).json({ message: 'Could not sync your account with the application database.' });
        }
        if (user) {
          if (user.removed) return res.status(423).json({ message: 'This account was removed. Contact an ArtVault administrator.' });
          if (user.status === 'suspended') {
            return res.status(423).json({ message: 'This artist account is suspended and awaiting administrator review.' });
          }
          if (user.lockUntil && user.lockUntil > Date.now()) {
            return res.status(423).json({
              message: 'Account locked after repeated failed attempts.',
              locked: true,
              secondsLeft: Math.ceil((user.lockUntil - Date.now()) / 1000),
            });
          }
          req.supabaseUserId = data.user.id;
          // Backup codes can independently protect an account without TOTP.
          // The setup OTP verifies its current session atomically with code creation.
          if (!allowMfaPending && claims?.aal !== 'aal2' && !needsMfa(data.user, claims)
            && await BackupSecurity.exists({ user: user._id, enabled: true })) {
            const sessionId = claims?.session_id;
            const verified = typeof sessionId === 'string' && (
              await BackupSecurity.exists({ user: user._id, enabled: true, verifiedSessionId: sessionId, verifiedSessionExpiresAt: mongoose.trusted({ $gt: new Date() }) })
              || await BackupRecoverySession.exists({ providerUserId: data.user.id, sessionId, expiresAt: mongoose.trusted({ $gt: new Date() }) })
            );
            if (!verified && !remembered) return res.status(403).json({ code: 'MFA_REQUIRED', message: 'Verify sign-in with a backup security code.' });
          }
          req.providerFactors = data.user.factors || [];
          req.authClaims = claims;
          req.user = user;
          return next();
        }
      }
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Artist.findById(payload.sub).select('+supabaseUserId');
    if (!user) return res.status(401).json({ message: 'This account no longer exists.' });
    if (user.supabaseUserId) return res.status(401).json({ message: 'Sign in using your verified account session.' });
    if (user.removed) return res.status(423).json({ message: 'This account was removed. Contact an ArtVault administrator.' });
    if (user.status === 'suspended') return res.status(423).json({ message: 'This artist account is suspended and awaiting administrator review.' });
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(423).json({
        message: 'Account locked after repeated failed attempts.',
        locked: true,
        secondsLeft: Math.ceil((user.lockUntil - Date.now()) / 1000),
      });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired or invalid — please sign in again.' });
  }
}

function requireAuth(req, res, next) { return authenticate(req, res, next); }
// Only backup-code redemption uses this: still requires a verified password
// session and all account restrictions; it cannot authenticate ordinary routes.
function requireRecoveryAuth(req, res, next) { return authenticate(req, res, next, true); }

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  return requireRole('admin', 'sub_admin', 'main_admin')(req, res, next);
}

module.exports = { requireAuth, requireRecoveryAuth, requireRole, requireAdmin };
