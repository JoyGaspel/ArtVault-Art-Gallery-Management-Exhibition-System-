const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Artist = require('../models/Artist');
const supabase = require('../config/supabase');

async function mirrorSupabaseUser(authUser) {
  if (!authUser?.email || !authUser.email_confirmed_at) return null;

  let user = await Artist.findOne({ supabaseUserId: authUser.id }).select('+supabaseUserId');
  if (!user) user = await Artist.findOne({ email: authUser.email.toLowerCase() });

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
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Sign in required for this action.' });

  try {
    if (supabase) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user) {
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
          if (user.status === 'suspended') {
            return res.status(423).json({ message: 'This artist account is suspended and awaiting administrator review.' });
          }
          req.supabaseUserId = data.user.id;
          req.user = user;
          return next();
        }
      }
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Artist.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'This account no longer exists.' });
    if (user.status === 'suspended') return res.status(423).json({ message: 'This artist account is suspended and awaiting administrator review.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired or invalid — please sign in again.' });
  }
}

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

module.exports = { requireAuth, requireRole, requireAdmin };
