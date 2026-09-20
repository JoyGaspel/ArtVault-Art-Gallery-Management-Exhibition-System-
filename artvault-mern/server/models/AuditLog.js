const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, enum: ['create', 'update', 'delete', 'restore', 'role_change', 'account_delete', 'permanent_delete', 'delete_request'] },
    entityType: { type: String, required: true, enum: ['artwork', 'exhibit', 'artist', 'archive'] },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
