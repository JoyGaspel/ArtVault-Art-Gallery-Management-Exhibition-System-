require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const artworkRoutes = require('./routes/artworkRoutes');
const artistRoutes = require('./routes/artistRoutes');
const exhibitRoutes = require('./routes/exhibitRoutes');
const archiveRoutes = require('./routes/archiveRoutes');
const auditRoutes = require('./routes/auditRoutes');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters in production.');
}

// Apply standard HTTP security headers before handling API requests.
// The frontend is deployed separately, so CSP is managed by the client host.
app.use(helmet({ contentSecurityPolicy: false }));

// Render terminates TLS at its proxy. Redirect any insecure forwarded request
// so API links and browser clients consistently use HTTPS in production.
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.get('x-forwarded-proto') === 'http') {
    return res.redirect(308, `https://${req.hostname}${req.originalUrl}`);
  }
  next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many sign-in attempts. Please try again later.' },
});

// Render/Vercel environment variables are often entered as a comma-separated
// list. Trim each value so an accidental space does not cause a CORS failure.
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
// Browsers treat localhost and 127.0.0.1 as different origins. Allow both
// local Vite addresses so either URL can authenticate during development.
for (const localOrigin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
  if (!allowedOrigins.includes(localOrigin)) allowedOrigins.push(localOrigin);
}
app.use(cors({
  origin(origin, callback) {
    // Requests from curl/health checks have no Origin header and are safe.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));
// Images are sent as data URLs and stored in MongoDB. MongoDB documents are
// limited to 16 MB; larger media should use GridFS in a future iteration.
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    service: 'artvault-server',
    database: connected ? 'connected' : 'disconnected',
    databaseName: mongoose.connection.name || null,
    supabase: process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY ? 'configured' : 'not configured',
  });
});

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/artworks', artworkRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/exhibits', exhibitRoutes);
app.use('/api/archives', archiveRoutes);
app.use('/api/audit-logs', auditRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  app.listen(PORT, () => console.log(`ArtVault API listening on http://localhost:${PORT}`));
}

start();

module.exports = app;
