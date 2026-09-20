const AuditLog = require('../models/AuditLog');

/** Record an administrative/content change without making the user wait for
 * a secondary logging write or allowing a logging outage to break the action. */
function recordAudit({ req, action, entityType, entityId, details = {} }) {
  if (!req?.user?._id || !entityId) return;
  AuditLog.create({
    actor: req.user._id,
    actorRole: req.user.role,
    action,
    entityType,
    entityId,
    details,
  }).catch((error) => console.error('Audit log write failed:', error.message));
}

module.exports = { recordAudit };
