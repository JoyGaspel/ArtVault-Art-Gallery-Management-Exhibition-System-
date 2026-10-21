require('dotenv').config();
const mongoose = require('mongoose');
const Artwork = require('../models/Artwork');
const { fingerprint } = require('../services/artworkDuplicates');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  let updated = 0; let skipped = 0;
  for await (const work of Artwork.find({ imageFingerprint: { $exists: false } }).select('image_path updated_at').lean().cursor()) {
    if (!/^data:image\//.test(work.image_path || '')) { skipped++; continue; }
    try {
      const hashes = await fingerprint(work.image_path);
      const result = await Artwork.updateOne({ _id: work._id, updated_at: work.updated_at }, { $set: hashes }, { timestamps: false });
      updated += result.modifiedCount;
    } catch { skipped++; }
  }
  console.log(JSON.stringify({ updated, skipped }));
})().catch(() => { console.error('Fingerprint backfill failed. Check database configuration.'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
