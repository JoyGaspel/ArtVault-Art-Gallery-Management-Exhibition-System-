const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const statePath = path.join(root, '.offline-state.json');
const defaultDatabase = 'artvault_offline';

function readOfflineDatabase() {
  if (!fs.existsSync(statePath)) return defaultDatabase;
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (/^artvault_offline(?:_\d{14}_[a-f0-9]{6})?$/.test(state.database)) return state.database;
  } catch { /* A broken pointer must never redirect the launcher to another DB. */ }
  throw new Error('The offline snapshot pointer is invalid. Check .offline-state.json before starting.');
}

function writeOfflineDatabase(database, sourceTime) {
  if (!/^artvault_offline_\d{14}_[a-f0-9]{6}$/.test(database)) throw new Error('Invalid offline database name.');
  fs.writeFileSync(statePath, `${JSON.stringify({ database, refreshedAt: sourceTime }, null, 2)}\n`, { flag: 'w', mode: 0o600 });
}

module.exports = { readOfflineDatabase, writeOfflineDatabase, statePath, defaultDatabase };
