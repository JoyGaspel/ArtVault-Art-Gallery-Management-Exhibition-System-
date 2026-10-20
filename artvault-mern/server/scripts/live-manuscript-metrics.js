// Read-only, aggregate-only extraction from the MongoDB configured for ArtVault.
// Run from artvault-mern/server with `node scripts/live-manuscript-metrics.js`.
require('dotenv').config();
const mongoose = require('mongoose');

const tally = (values) => values.reduce((result, value) => {
  const key = String(value ?? 'missing');
  result[key] = (result[key] || 0) + 1;
  return result;
}, {});

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const collections = {
    artists: 'artists', artworks: 'artworks', exhibits: 'exhibits',
    entries: 'Submit_Exhibit_Entry', likes: 'artwork_likes',
    notifications: 'notifications', auditLogs: 'auditlogs', archives: 'archives',
  };
  const counts = Object.fromEntries(await Promise.all(Object.entries(collections)
    .map(async ([key, name]) => [key, await db.collection(name).countDocuments()])));
  const [artists, artworks, exhibits, likes, entries, notifications, auditLogs] = await Promise.all([
    db.collection(collections.artists).find({}, { projection: { role: 1, status: 1, specializations: 1 } }).toArray(),
    db.collection(collections.artworks).find({}, { projection: { visibility: 1, categories: 1, created_at: 1 } }).toArray(),
    db.collection(collections.exhibits).find({}, { projection: { artworks: 1 } }).toArray(),
    db.collection(collections.likes).find({}, { projection: { artwork: 1 } }).toArray(),
    db.collection(collections.entries).find({}, { projection: { status: 1 } }).toArray(),
    db.collection(collections.notifications).find({}, { projection: { type: 1 } }).toArray(),
    db.collection(collections.auditLogs).find({}, { projection: { action: 1, createdAt: 1 } }).toArray(),
  ]);
  const likesByArtwork = tally(likes.map((item) => item.artwork));
  const month = (date) => date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 7) : 'missing';

  console.log(JSON.stringify({
    source: 'current ArtVault MongoDB database configured by MONGO_URI',
    databaseName: db.databaseName,
    capturedAtUtc: new Date().toISOString(),
    counts,
    artistsByRole: tally(artists.map((item) => item.role)),
    artistsByStatus: tally(artists.map((item) => item.status)),
    artistSpecializations: tally(artists.flatMap((item) => [...new Set(item.specializations || [])])),
    artworkVisibility: tally(artworks.map((item) => item.visibility || 'public')),
    artworkCategories: tally(artworks.flatMap((item) => [...new Set(item.categories || [])])),
    artworksByMonth: tally(artworks.map((item) => month(item.created_at))),
    likesPerArtworkBins: tally(artworks.map((item) => {
      const count = likesByArtwork[String(item._id)] || 0;
      return count >= 3 ? '3+' : count;
    })),
    artworksWithLikes: artworks.filter((item) => (likesByArtwork[String(item._id)] || 0) > 0).length,
    artworksPerExhibit: exhibits.map((item) => (item.artworks || []).length).sort((a, b) => a - b),
    exhibitEntryStatus: tally(entries.map((item) => item.status)),
    notificationType: tally(notifications.map((item) => item.type)),
    auditAction: tally(auditLogs.map((item) => item.action)),
    auditByMonth: tally(auditLogs.map((item) => month(item.createdAt))),
  }, null, 2));
}

main().catch((error) => {
  console.error(`Read-only metrics extraction failed: ${error.message}`);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
