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
    });
  } else if (!user.supabaseUserId) {
    user.supabaseUserId = authUser.id;
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
        const user = await mirrorSupabaseUser(data.user);
        if (user) {
          req.user = user;
          return next();
        }
      }
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Artist.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'This account no longer exists.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired or invalid — please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (!['admin', 'sub_admin', 'main_admin'].includes(req.user.role)) return res.status(403).json({ message: 'Administrator access required.' });
  next();
}

module.exports = { requireAuth, requireAdmin };
