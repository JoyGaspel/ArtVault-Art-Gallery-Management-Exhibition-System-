const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createRateLimiters } = require('../middleware/rateLimits');

async function withTestServer(limits, run) {
  const app = express();
  app.set('trust proxy', 1);
  const { apiLimiter, authRouteLimiter, failedLoginLimiter } = createRateLimiters(limits);

  const auth = express.Router();
  auth.get('/me', (req, res) => res.json({ ok: true }));
  auth.post('/login', (req, res) => res.status(401).json({ message: 'Invalid credentials.' }));
  app.use('/api/auth', authRouteLimiter, failedLoginLimiter, auth);
  app.use('/api', apiLimiter);
  app.get('/api/artworks', (req, res) => res.json({ ok: true }));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('gallery requests cannot use up the sign-in verification budget', async () => {
  await withTestServer({ apiLimit: 2, authLimit: 10, failedLoginLimit: 1 }, async (baseUrl) => {
    for (let i = 0; i < 2; i += 1) {
      assert.equal((await fetch(`${baseUrl}/api/artworks`)).status, 200);
    }
    assert.equal((await fetch(`${baseUrl}/api/artworks`)).status, 429);
    assert.equal((await fetch(`${baseUrl}/api/auth/me`)).status, 200);

    assert.equal((await fetch(`${baseUrl}/api/auth/login`, { method: 'POST' })).status, 401);
    const blockedLogin = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST' });
    assert.equal(blockedLogin.status, 429);
    assert.match((await blockedLogin.json()).message, /sign-in attempts/i);
    assert.equal((await fetch(`${baseUrl}/api/auth/me`)).status, 200);
  });
});

test('authentication requests retain their own traffic limit', async () => {
  await withTestServer({ apiLimit: 2, authLimit: 2, failedLoginLimit: 1 }, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/auth/me`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/auth/me`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/auth/me`)).status, 429);
    assert.equal((await fetch(`${baseUrl}/api/artworks`)).status, 200);
  });
});
