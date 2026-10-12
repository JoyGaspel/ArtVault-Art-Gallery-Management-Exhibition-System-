const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const serverDir = path.join(root, 'server');
const clientDir = path.join(root, 'client');
const serverRequire = createRequire(path.join(serverDir, 'package.json'));
const mongoose = serverRequire('mongoose');
const API_PORT = 5500;
const WEB_PORT = 5174;

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(2000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}

async function main() {
  if (!await portOpen(27017)) throw new Error('Local MongoDB is not running on 127.0.0.1:27017. Start the MongoDB Windows service first.');
  if (await portOpen(API_PORT) || await portOpen(WEB_PORT)) throw new Error(`Offline port ${API_PORT} or ${WEB_PORT} is already in use. Stop the older offline copy before starting another.`);

  await mongoose.connect('mongodb://127.0.0.1:27017/artvault_offline', { serverSelectionTimeoutMS: 3000 });
  const counts = await Promise.all(['artworks', 'artists', 'exhibits'].map((name) => mongoose.connection.db.collection(name).estimatedDocumentCount()));
  await mongoose.disconnect();
  if (!counts.some(Boolean)) {
    throw new Error('artvault_offline has no ArtVault data yet. Restore a mongodump backup first with node scripts/restore-offline.js "C:\\path\\to\\backup.archive".');
  }

  const localEnv = {
    ...process.env,
    NODE_ENV: 'development',
    ARTVAULT_OFFLINE: 'true',
    ARTVAULT_OFFLINE_API_PORT: String(API_PORT),
    VITE_OFFLINE_READONLY: 'true',
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_PUBLISHABLE_KEY: '',
    SUPABASE_URL: '',
    SUPABASE_PUBLISHABLE_KEY: '',
    SUPABASE_SECRET_KEY: '',
    MONGO_URI: 'mongodb://127.0.0.1:27017/artvault_offline',
    HOST: '127.0.0.1',
    PORT: String(API_PORT),
    EMAIL_NOTIFICATIONS_ENABLED: 'false',
  };
  const vite = path.join(clientDir, 'node_modules', 'vite', 'bin', 'vite.js');
  const processes = [
    spawn(process.execPath, ['server.js'], { cwd: serverDir, env: localEnv, stdio: 'inherit' }),
    spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(WEB_PORT), '--strictPort'], { cwd: clientDir, env: localEnv, stdio: 'inherit' }),
  ];
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    processes.forEach((child) => { if (!child.killed) child.kill(); });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  processes.forEach((child) => child.on('exit', (code) => {
    if (!stopping) {
      console.error(`An offline component stopped (${code ?? 'signal'}).`);
      stop();
      process.exitCode = code || 1;
    }
  }));
  console.log(`Offline ArtVault is starting at http://127.0.0.1:${WEB_PORT} (browse-only). Press Ctrl+C to stop it.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
