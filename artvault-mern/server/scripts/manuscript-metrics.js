// Read-only aggregate snapshot for the final-defense manuscript.
// Never prints individual user records, credentials, or artwork image data.
const mongoose = require('mongoose');

const uri = 'mongodb://127.0.0.1:27017/artvault_offline';

const tally = (values) => values.reduce((result, value) => {
  const key = String(value ?? 'missing');
  result[key] = (result[key] || 0) + 1;
  return result;
}, {});

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
  const db = mongoose.connection.db;
  const collectionNames = [
    'artists', 'artworks', 'exhibits', 'Submit_Exhibit_Entry',
    'artwork_likes', 'notifications', 'auditlogs', 'archives',
  ];
  const counts = Object.fromEntries(await Promise.all(collectionNames.map(async (name) => [
    name, await db.collection(name).countDocuments(),
  ])));
  const [artists, artworks, exhibits, likes, entries, notifications, auditLogs] = await Promise.all([
    db.collection('artists').find({}, { projection: { role: 1, status: 1 } }).toArray(),
    db.collection('artworks').find({}, { projection: { visibility: 1, categories: 1, created_at: 1 } }).toArray(),
    db.collection('exhibits').find({}, { projection: { artworks: 1, event_date: 1 } }).toArray(),
    db.collection('artwork_likes').find({}, { projection: { artwork: 1 } }).toArray(),
    db.collection('Submit_Exhibit_Entry').find({}, { projection: { status: 1 } }).toArray(),
    db.collection('notifications').find({}, { projection: { type: 1 } }).toArray(),
    db.collection('auditlogs').find({}, { projection: { action: 1, entityType: 1, createdAt: 1 } }).toArray(),
  ]);
  const likesByArtwork = tally(likes.map((item) => item.artwork));
  const likeBins = tally(artworks.map((item) => {
    const count = likesByArtwork[String(item._id)] || 0;
    return count >= 3 ? '3+' : count;
  }));
  const month = (date) => date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 7) : 'missing';
  const output = {
    source: 'local artvault_offline snapshot restored from 2026-10-12 mongodump',
    counts,
    artistsByRole: tally(artists.map((item) => item.role)),
    artistsByStatus: tally(artists.map((item) => item.status)),
    artworkVisibility: tally(artworks.map((item) => item.visibility || 'public')),
    artworkCategories: tally(artworks.flatMap((item) => [...new Set(item.categories || [])])),
    artworksByMonth: tally(artworks.map((item) => month(item.created_at))),
    likesPerArtworkBins: likeBins,
    artworksWithLikes: artworks.filter((item) => (likesByArtwork[String(item._id)] || 0) > 0).length,
    artworksPerExhibit: exhibits.map((item) => (item.artworks || []).length).sort((a, b) => a - b),
    exhibitEntryStatus: tally(entries.map((item) => item.status)),
    notificationType: tally(notifications.map((item) => item.type)),
    auditAction: tally(auditLogs.map((item) => item.action)),
    auditByMonth: tally(auditLogs.map((item) => month(item.createdAt))),
  };
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
