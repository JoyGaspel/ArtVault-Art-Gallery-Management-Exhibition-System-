const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  target: { type: mongoose.Schema.Types.ObjectId, required: true },
  fromRole: String, toRole: String, digest: { type: String, select: false },
  attempts: { type: Number, default: 0 }, sentAt: Date, expiresAt: Date,
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('RoleChangeChallenge', schema);
