// PROTOTYPE AUTH ONLY — replace these localStorage operations with the API calls
// in AuthContext once MongoDB and the server session/cookie configuration are live.
// A browser prototype cannot issue an HttpOnly cookie or hash passwords securely.

const USERS_KEY = 'artvault_prototype_users';
const ATTEMPTS_KEY = 'artvault_prototype_login_attempts';
const SESSION_KEY = 'artvault_prototype_session';
const SESSION_IDLE_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 5 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 3;

const demoUsers = [
  { id: 'prototype-artist-juan', name: 'Juan Dela Cruz', email: 'juan@artvault.com', password: 'artist123', role: 'artist', specializations: ['Digital Art'], bio: 'Prototype artist account.' },
  { id: 'prototype-admin', name: 'ArtVault Administrator', email: 'admin@artvault.com', password: 'admin123', role: 'admin', specializations: [], bio: '' },
];

function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function safeUser(user) {
  const { password, ...safe } = user;
  return safe;
}

function users() {
  const stored = read(USERS_KEY, null);
  if (stored) return stored;
  write(USERS_KEY, demoUsers);
  return demoUsers;
}

function createSession(user) {
  const session = { user: safeUser(user), expiresAt: Date.now() + SESSION_IDLE_MS };
  write(SESSION_KEY, session);
  localStorage.setItem('artvault_token', 'prototype-session');
  return session.user;
}

export function restorePrototypeSession() {
  const session = read(SESSION_KEY, null);
  if (!session || session.expiresAt <= Date.now()) {
    clearPrototypeSession();
    return null;
  }
  return session.user;
}

export function refreshPrototypeSession() {
  const session = read(SESSION_KEY, null);
  if (!session || session.expiresAt <= Date.now()) return null;
  session.expiresAt = Date.now() + SESSION_IDLE_MS;
  write(SESSION_KEY, session);
  return session;
}

export function prototypeSessionRemaining() {
  const session = read(SESSION_KEY, null);
  return Math.max(0, (session?.expiresAt || 0) - Date.now());
}

export function clearPrototypeSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('artvault_token');
}

export async function prototypeLogin(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const attemptState = read(ATTEMPTS_KEY, {});
  const record = attemptState[normalizedEmail] || { count: 0, lockedUntil: 0 };

  if (record.lockedUntil > Date.now()) {
    throw { message: 'Account locked after repeated failed attempts.', locked: true, secondsLeft: Math.ceil((record.lockedUntil - Date.now()) / 1000) };
  }

  const user = users().find((candidate) => candidate.email === normalizedEmail);
  // PROTOTYPE ONLY: direct password comparison. Production must use bcrypt on the server.
  if (!user || user.password !== password) {
    record.count += 1;
    if (record.count >= MAX_FAILED_ATTEMPTS) {
      record.count = 0;
      record.lockedUntil = Date.now() + LOCKOUT_MS;
      attemptState[normalizedEmail] = record;
      write(ATTEMPTS_KEY, attemptState);
      throw { message: 'Too many failed attempts. Locked for 5 minutes.', locked: true, secondsLeft: LOCKOUT_MS / 1000 };
    }
    attemptState[normalizedEmail] = record;
    write(ATTEMPTS_KEY, attemptState);
    throw { message: 'Invalid credentials.', attemptsRemaining: MAX_FAILED_ATTEMPTS - record.count };
  }

  delete attemptState[normalizedEmail];
  write(ATTEMPTS_KEY, attemptState);
  return createSession(user);
}

export async function prototypeSignup(payload) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const existingUsers = users();
  if (existingUsers.some((user) => user.email === normalizedEmail)) {
    throw { message: 'That email is already registered — try signing in instead.' };
  }
  const user = {
    id: `prototype-artist-${Date.now()}`,
    name: payload.name.trim(),
    firstName: payload.firstName,
    lastName: payload.lastName,
    extensionName: payload.extensionName || '',
    email: normalizedEmail,
    password: payload.password,
    role: 'artist',
    specializations: payload.specializations || [],
    bio: payload.bio || '',
  };
  write(USERS_KEY, [...existingUsers, user]);
  return createSession(user);
}
