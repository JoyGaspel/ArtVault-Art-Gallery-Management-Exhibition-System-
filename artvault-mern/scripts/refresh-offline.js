// Creates a new, independent local snapshot from the live Atlas database.
// No Atlas writes, no local drop, and no replacement of an earlier snapshot.
const crypto = require('node:crypto');
const path = require('node:path');
const { createRequire } = require('node:module');
const { readOfflineDatabase, writeOfflineDatabase } = require('./offline-state');

const serverDir = path.resolve(__dirname, '..', 'server');
const serverRequire = createRequire(path.join(serverDir, 'package.json'));
serverRequire('dotenv').config({ path: path.join(serverDir, '.env') });
const { MongoClient } = serverRequire('mongodb');
const remoteUri = process.env.MONGO_URI || '';
const localUri = 'mongodb://127.0.0.1:27017';
const core = ['artists', 'artworks', 'exhibits'];

async function main() {
  if (!/^mongodb(\+srv)?:\/\//i.test(remoteUri) || /^mongodb:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::|\/)/i.test(remoteUri)) {
    throw new Error('server/.env must contain the live Atlas MONGO_URI, not the local MongoDB URI. No snapshot was created.');
  }
  const remote = new MongoClient(remoteUri, { serverSelectionTimeoutMS: 12000, readPreference: 'primary', readConcern: { level: 'majority' } });
  const local = new MongoClient(localUri, { serverSelectionTimeoutMS: 3000 });
  try {
    await Promise.all([remote.connect(), local.connect()]);
    const liveDb = remote.db();
    if (liveDb.databaseName !== 'artvault') throw new Error(`Expected the live database to be artvault, not ${liveDb.databaseName}. No local snapshot was selected.`);
    const names = (await liveDb.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name).filter((name) => !name.startsWith('system.'));
    if (!core.every((name) => names.includes(name))) throw new Error('The live database is missing artists, artworks, or exhibits. No local snapshot was selected.');
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const dbName = `artvault_offline_${stamp}_${crypto.randomBytes(3).toString('hex')}`;
    const snapshot = local.db(dbName);
    if ((await snapshot.listCollections({}, { nameOnly: true }).toArray()).length) throw new Error('The new snapshot database already exists. Nothing was overwritten.');
    console.log(`Copying ${names.length} Atlas collections into new local database ${dbName}...`);
    const counts = {};
    for (const name of names) {
      await snapshot.createCollection(name);
      let count = 0;
      const cursor = liveDb.collection(name).find({}, { batchSize: 20 });
      for await (const document of cursor) {
        await snapshot.collection(name).insertOne(document);
        count += 1;
      }
      counts[name] = count;
      console.log(`${name}: ${count}`);
    }
    if (!core.some((name) => counts[name] > 0)) throw new Error('Atlas returned no core data. The previous offline snapshot remains selected.');
    const previous = readOfflineDatabase();
    writeOfflineDatabase(dbName, new Date().toISOString());
    console.log(`New snapshot ready: ${dbName}. Previous snapshot ${previous} was kept. Restart node scripts/start-offline.js to use the new copy.`);
  } finally {
    await Promise.allSettled([remote.close(), local.close()]);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
