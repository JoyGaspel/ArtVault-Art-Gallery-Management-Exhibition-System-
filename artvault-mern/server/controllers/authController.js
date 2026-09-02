const jwt = require('jsonwebtoken');
const Artist = require('../models/Artist');

const MAX_FAILED_ATTEMPTS = 3;
const LOCK_DURATION_MS = 5 * 60 * 1000; // STEP 2 of the flowchart — 5 minute lockout

function generateToken(user) {
  return jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/signup
async function signup(req, res, next) {
  try {
    const { name, email, password, role, specializations, bio } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await Artist.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'That email is already registered — try signing in instead.' });
    }

    // Self-serve signup only ever creates Artist accounts. Administrator
    // accounts are provisioned separately (see README), matching the note
    // shown on the sign-up page.
    const user = await Artist.create({
      name,
      email,
      password, // hashed by the pre-save hook on the model
      role: role === 'admin' ? 'artist' : 'artist',
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
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await Artist.findOne({ email: email.toLowerCase() }).select('+password');

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
    await user.save();

    const token = generateToken(user);
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function me(req, res) {
  res.json({ user: req.user.toSafeObject() });
}

module.exports = { signup, login, me };
