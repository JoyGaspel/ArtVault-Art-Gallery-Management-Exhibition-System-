const { rateLimit } = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;

function createRateLimiters({ windowMs = WINDOW_MS, apiLimit = 1200, authLimit = 300, failedLoginLimit = 10 } = {}) {
  const sharedOptions = { windowMs, standardHeaders: 'draft-8', legacyHeaders: false };

  return {
    // Gallery browsing and its background refreshes must not consume the
    // separate budget used to verify a sign-in.
    apiLimiter: rateLimit({
      ...sharedOptions,
      limit: apiLimit,
      message: { message: 'Too many requests. Please try again later.' },
    }),
    authRouteLimiter: rateLimit({
      ...sharedOptions,
      limit: authLimit,
      message: { message: 'Too many authentication requests. Please try again later.' },
    }),
    // Only failed legacy password checks count toward this stricter limit.
    // A failed /auth/me check must not prevent a subsequent valid sign-in.
    failedLoginLimiter: rateLimit({
      ...sharedOptions,
      limit: failedLoginLimit,
      skipSuccessfulRequests: true,
      skip: (req) => req.method !== 'POST' || req.path !== '/login',
      message: { message: 'Too many sign-in attempts. Please try again later.' },
    }),
  };
}

module.exports = { createRateLimiters };
