// Run manually on the trusted Windows computer. Never starts with the web server.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const serverRequire = createRequire(path.join(root, 'server', 'package.json'));
serverRequire('dotenv').config({ path: path.join(root, 'server', '.env'), quiet: true });
const { MongoClient } = serverRequire('mongodb');
const databaseName = 'artvault';
const importantCollections = ['artists', 'artworks', 'exhibits'];
const backupDirectory = process.env.ARTVAULT_BACKUP_DIR || path.join(os.homedir(), 'Documents', 'ArtVaultBackups');
const toolDirectory = 'C:\\Program Files\\MongoDB\\Tools\\100\\bin';

function tool(name) {
  const configured = process.env[`ARTVAULT_${name.toUpperCase()}_PATH`];
  const installed = path.join(toolDirectory, `${name}.exe`);
  return configured || (fs.existsSync(installed) ? installed : name);
}

function run(name, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(tool(name), args, { stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${name} failed (exit ${code}).`)));
  });
}

function atlasUri() {
  const uri = process.env.MONGO_URI || '';
  if (!uri.startsWith('mongodb+srv://') || !/\.mongodb\.net(?::\d+)?(?:\/|\?|$)/i.test(uri)) {
    throw new Error('MONGO_URI must be a MongoDB Atlas URI in server/.env. Nothing was changed.');
  }
  const database = new URL(uri).pathname.replace(/^\//, '');
  if (database && database !== databaseName) throw new Error('MONGO_URI targets a different database. Nothing was changed.');
  return uri;
}

async function withConfig(uri, callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'artvault-defense-'));
  const config = path.join(directory, 'mongo.yml');
  try {
    fs.writeFileSync(config, `uri: ${JSON.stringify(uri)}\n`, { mode: 0o600, flag: 'wx' });
    return await callback(config);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function collectionCounts(uri) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    const db = client.db(databaseName);
    const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((entry) => entry.name);
    const counts = {};
    for (const name of names) counts[name] = await db.collection(name).countDocuments({});
    return counts;
  } finally {
    await client.close();
  }
}

function digest(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', () => resolve(hash.digest('hex')));
  });
}

async function verify(archive) {
  const file = fs.realpathSync(archive);
  if (!file.endsWith('.archive.gz') || !fs.statSync(file).isFile()) throw new Error('Use a .archive.gz file.');
  const manifestPath = `${file}.json`;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.database !== databaseName || manifest.file !== path.basename(file) || !manifest.sha256) {
    throw new Error('Backup manifest does not match this ArtVault archive.');
  }
  if ((await digest(file)) !== manifest.sha256) throw new Error('Backup SHA-256 mismatch. Restore cancelled.');
  await run('mongorestore', ['--uri=mongodb://127.0.0.1:27017', '--dryRun', '--gzip', `--archive=${file}`, `--nsInclude=${databaseName}.*`]);
  return { file, manifest };
}

async function backup() {
  const uri = atlasUri();
  const before = await collectionCounts(uri);
  if (importantCollections.some((name) => !before[name])) throw new Error('Core ArtVault collections are missing or empty. Refusing to create a misleading backup.');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
  const file = path.join(backupDirectory, `artvault-defense-${stamp}.archive.gz`);
  const pending = `${file}.pending`;
  if (fs.existsSync(file) || fs.existsSync(pending)) throw new Error('Backup filename already exists; wait a second and retry.');
  try {
    console.log(`Creating a fresh Atlas backup in ${backupDirectory}...`);
    await withConfig(uri, (config) => run('mongodump', [`--config=${config}`, `--archive=${pending}`, '--gzip', `--db=${databaseName}`]));
    if (fs.statSync(pending).size < 1024) throw new Error('The backup archive is unexpectedly small.');
    fs.renameSync(pending, file);
    const manifest = { database: databaseName, file: path.basename(file), createdAt: new Date().toISOString(), counts: before, sha256: await digest(file) };
    fs.writeFileSync(`${file}.json`, JSON.stringify(manifest, null, 2), { flag: 'wx' });
    await verify(file);
    console.log(`Backup verified: ${file}`);
    console.log(`Restore when Atlas is genuinely empty: node scripts/defense-recovery.js restore "${file}"`);
  } finally {
    if (fs.existsSync(pending)) fs.unlinkSync(pending);
  }
}

async function restore(archive) {
  if (!archive) throw new Error('Provide the full backup archive path.');
  const { file, manifest } = await verify(archive);
  const uri = atlasUri();
  for (let attempt = 1; attempt <= 2; attempt++) {
    const counts = await collectionCounts(uri);
    if (Object.values(counts).some((count) => count > 0)) {
      throw new Error('Atlas artvault still contains data. Refusing to overwrite or merge it.');
    }
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  console.log('Atlas artvault was confirmed empty twice. Restoring without --drop...');
  await withConfig(uri, (config) => run('mongorestore', [`--config=${config}`, '--gzip', `--archive=${file}`, `--nsInclude=${databaseName}.*`, '--stopOnError']));
  const after = await collectionCounts(uri);
  for (const name of importantCollections) {
    if (!after[name]) throw new Error(`Restore completed but ${name} is empty. Inspect Atlas immediately.`);
  }
  console.log(`Restore complete. ${Object.keys(after).length} collections found. Backup date: ${manifest.createdAt}.`);
  console.log('Review Atlas data and restart the backend only if it did not reconnect on its own.');
}

async function main() {
  const [command, source] = process.argv.slice(2);
  if (command === 'backup') return backup();
  if (command === 'verify') { await verify(source); return console.log('Archive and checksum verified; no database was changed.'); }
  if (command === 'restore') return restore(source);
  throw new Error('Usage: node scripts/defense-recovery.js backup | verify <archive> | restore <archive>');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
