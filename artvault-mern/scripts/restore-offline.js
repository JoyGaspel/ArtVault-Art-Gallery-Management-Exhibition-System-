const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const serverRequire = createRequire(path.join(root, 'server', 'package.json'));
const mongoose = serverRequire('mongoose');
const sourceArg = process.argv[2];
const localUri = 'mongodb://127.0.0.1:27017';
const localDb = 'artvault_offline';

function findRestoreTool() {
  const configured = process.env.MONGORESTORE_PATH;
  const candidates = [
    configured,
    'C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongorestore.exe',
    'mongorestore',
  ].filter(Boolean);
  return candidates.find((candidate) => candidate === 'mongorestore' || fs.existsSync(candidate));
}

function run(tool, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(tool, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`mongorestore exited with code ${code}.`)));
  });
}

async function main() {
  if (!sourceArg) throw new Error('Usage: node scripts/restore-offline.js "C:\\path\\to\\backup.archive"');
  const source = fs.realpathSync(path.resolve(sourceArg));
  const stat = fs.statSync(source);
  let input;
  let gzip = false;
  if (stat.isFile()) {
    if (!/\.(archive|gz)$/i.test(source)) throw new Error('Choose a mongodump .archive or .gz archive file, not another file type.');
    input = [`--archive=${source}`];
    gzip = /\.gz$/i.test(source);
  } else if (stat.isDirectory()) {
    const folder = path.basename(source).toLowerCase() === 'artvault' ? path.dirname(source) : source;
    if (!fs.existsSync(path.join(folder, 'artvault'))) throw new Error('Choose the dump folder that contains the artvault subfolder.');
    input = [`--dir=${folder}`];
    gzip = fs.readdirSync(path.join(folder, 'artvault')).some((name) => name.endsWith('.bson.gz'));
  } else throw new Error('The backup path must be an archive or dump folder.');

  await mongoose.connect(`${localUri}/${localDb}`, { serverSelectionTimeoutMS: 3000 });
  const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
  const occupied = [];
  for (const { name } of collections) {
    if (await mongoose.connection.db.collection(name).estimatedDocumentCount() > 0) occupied.push(name);
  }
  await mongoose.disconnect();
  if (occupied.length) throw new Error(`${localDb} already has data in ${occupied.join(', ')}. Nothing was overwritten. Use a fresh local database before restoring again.`);

  const tool = findRestoreTool();
  const args = [
    `--uri=${localUri}`,
    '--nsInclude=artvault.*',
    '--nsFrom=artvault.*',
    `--nsTo=${localDb}.*`,
    '--stopOnError',
    ...(gzip ? ['--gzip'] : []),
    ...input,
  ];
  console.log(`Checking the backup before restoring it into the empty local ${localDb} database...`);
  await run(tool, ['--dryRun', ...args]);
  console.log(`Restoring into local ${localDb}. Atlas is not modified.`);
  await run(tool, args);

  await mongoose.connect(`${localUri}/${localDb}`, { serverSelectionTimeoutMS: 3000 });
  const restored = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
  await mongoose.disconnect();
  if (!restored.some(({ name }) => ['artworks', 'artists', 'exhibits'].includes(name))) throw new Error('Restore finished but no ArtVault collections were found. Check that the backup contains the artvault database.');
  console.log(`Local restore complete: ${restored.length} collections. Run: node scripts/start-offline.js`);
}

main().catch(async (error) => {
  if (mongoose.connection.readyState) await mongoose.disconnect().catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
});
