const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  providerUserId: { type: String, required: true },
  sessionId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});
schema.index({ providerUserId: 1, sessionId: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('BackupRecoverySession', schema);
