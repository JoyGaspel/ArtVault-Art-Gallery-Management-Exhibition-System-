require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const artworkRoutes = require('./routes/artworkRoutes');
const artistRoutes = require('./routes/artistRoutes');
const exhibitRoutes = require('./routes/exhibitRoutes');
const archiveRoutes = require('./routes/archiveRoutes');

const app = express();

// Render/Vercel environment variables are often entered as a comma-separated
// list. Trim each value so an accidental space does not cause a CORS failure.
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
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

app.use('/api/auth', authRoutes);
app.use('/api/artworks', artworkRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/exhibits', exhibitRoutes);
app.use('/api/archives', archiveRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  app.listen(PORT, () => console.log(`ArtVault API listening on http://localhost:${PORT}`));
}

start();

module.exports = app;
