const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Artist = require('../models/Artist');

const MAX_FAILED_ATTEMPTS = 3;
const BCRYPT_ROUNDS = 12;
const LOCK_DURATION_MS = 5 * 60 * 1000; // STEP 2 of the flowchart — 5 minute lockout

function generateToken(user) {
  return jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
  });
}

// POST /api/auth/signup
async function signup(req, res, next) {
  try {
    const { name, email, password, specializations, bio } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
    const firstName = typeof req.body.firstName === 'string' ? req.body.firstName.trim() : '';
    const lastName = typeof req.body.lastName === 'string' ? req.body.lastName.trim() : '';

    if (!normalizedName || !normalizedEmail || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (firstName && (!/^[A-Z][A-Za-z]{1,49}$/.test(firstName) || firstName.length > 50)) return res.status(400).json({ message: 'First name must start with a capital letter and contain 2–50 letters.' });
    if (lastName && (!/^[A-Z][A-Za-z]{1,49}(?: [A-Z][A-Za-z]{1,49})*$/.test(lastName) || lastName.length > 50)) return res.status(400).json({ message: 'Last name must start with a capital letter and contain 2–50 letters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    if (password.length > 128) {
      return res.status(400).json({ message: 'Password must be 128 characters or fewer.' });
    }

    const existing = await Artist.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'That email is already registered — try signing in instead.' });
    }

    // Self-serve signup only ever creates Artist accounts. Administrator
    // accounts are provisioned separately (see README), matching the note
    // shown on the sign-up page.
    const user = await Artist.create({
      name: normalizedName.slice(0, 120),
      email: normalizedEmail,
      password, // hashed by the pre-save hook on the model
      // Never accept a role from a public request.
      role: 'artist',
      specializations: specializations || [],
      bio: bio || '',
    });

    const token = generateToken(user);
    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    if (password.length > 128) return res.status(400).json({ message: 'Password must be 128 characters or fewer.' });

    const user = await Artist.findOne({ email: normalizedEmail }).select('+password +supabaseUserId');

    if (user?.status === 'suspended') {
      return res.status(423).json({ message: 'This artist account is suspended and awaiting administrator review.' });
    }

    if (user?.supabaseUserId && !user.emailConfirmedAt) {
      return res.status(403).json({ message: 'Please confirm your email before signing in.' });
    }

    // STEP 2 — locked accounts are rejected before any password check
    if (user && user.lockUntil && user.lockUntil > Date.now()) {
      const secondsLeft = Math.ceil((user.lockUntil - Date.now()) / 1000);
      return res.status(423).json({
        message: 'Account locked after repeated failed attempts.',
        locked: true,
        secondsLeft,
      });
    }

    // STEP 1 — bcrypt.compare hashes the submitted password and checks it
    // against the stored hash; no plaintext password is ever compared.
    const validPassword = user ? await user.comparePassword(password) : false;

    if (!user || !validPassword) {
      if (user) {
        user.failedLoginAttempts += 1;
        if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
          user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
          user.failedLoginAttempts = 0;
          await user.save();
          return res.status(423).json({
            message: 'Too many failed attempts. Locked for 5 minutes.',
            locked: true,
            secondsLeft: LOCK_DURATION_MS / 1000,
          });
        }
        await user.save();
        return res.status(401).json({
          message: 'Invalid credentials.',
          attemptsRemaining: MAX_FAILED_ATTEMPTS - user.failedLoginAttempts,
        });
      }
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // success — reset the counter, issue the session
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    // Upgrade hashes created with an older bcrypt cost after a successful login.
    if (bcrypt.getRounds(user.password) < BCRYPT_ROUNDS) user.password = password;
    await user.save();

    const token = generateToken(user);
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login-success
// Supabase verifies the password, while MongoDB stores the shared lockout
// counters. Reset the counter after a successful Supabase sign-in.
async function loginSuccess(req, res, next) {
  try {
    req.user.failedLoginAttempts = 0;
    req.user.lockUntil = null;
    await req.user.save();
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// GET /api/auth/me
async function me(req, res) {
  res.json({ user: req.user.toSafeObject() });
}

module.exports = { signup, login, loginSuccess, me };
