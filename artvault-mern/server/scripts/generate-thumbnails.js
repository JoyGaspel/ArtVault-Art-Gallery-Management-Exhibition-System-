require('dotenv').config();
const mongoose = require('mongoose');
const sharp = require('sharp');
const Artwork = require('../models/Artwork');

async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set.');
  console.log('Connecting to MongoDB for thumbnail migration...');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  let processed = 0;
  let skipped = 0;
  const filter = {
    image_path: /^data:image\//,
    $or: [{ thumbnail_path: { $exists: false } }, { thumbnail_path: '' }],
  };
  const total = await Artwork.countDocuments(filter);
  console.log(`Found ${total} artwork${total === 1 ? '' : 's'} without thumbnails.`);
  // Keep batches tiny because originals may be several megabytes each.
  const cursor = Artwork.find(filter).select('_id image_path').batchSize(1).cursor();

  for await (const artwork of cursor) {
    console.log(`Processing ${artwork._id}...`);
    const match = /^data:[^;]+;base64,(.+)$/s.exec(artwork.image_path || '');
    if (!match) { skipped += 1; continue; }
    try {
      const thumbnail = await sharp(Buffer.from(match[1], 'base64'))
        .rotate()
        .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
      await Artwork.updateOne({ _id: artwork._id }, { $set: { thumbnail_path: `data:image/webp;base64,${thumbnail.toString('base64')}` } });
      processed += 1;
      console.log(`Thumbnail generated for ${artwork._id}`);
    } catch (error) {
      skipped += 1;
      console.warn(`Skipped ${artwork._id}: ${error.message}`);
    }
  }
  console.log(`Thumbnail migration complete. Processed: ${processed}; skipped: ${skipped}. Originals were preserved.`);
}

run()
  .then(async () => { await mongoose.disconnect(); })
  .catch(async (error) => { console.error('Thumbnail migration failed:', error.message); await mongoose.disconnect(); process.exitCode = 1; });
