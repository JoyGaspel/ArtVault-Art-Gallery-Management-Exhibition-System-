const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, unique: true },
  enabled: { type: Boolean, default: false },
  verifiedSessionId: { type: String, default: '' },
  verifiedSessionExpiresAt: { type: Date, default: null },
  hashes: { type: [String], default: [], select: false },
  otpHash: { type: String, default: '', select: false },
  otpPurpose: { type: String, enum: ['', 'generate', 'disable'], default: '' },
  otpExpiresAt: { type: Date, default: null },
  otpSentAt: { type: Date, default: null },
  otpAttempts: { type: Number, default: 0 },
  failedRecoveries: { type: Number, default: 0 },
  recoveryLockedUntil: { type: Date, default: null },
}, { timestamps: true });
module.exports = mongoose.model('BackupSecurity', schema);
