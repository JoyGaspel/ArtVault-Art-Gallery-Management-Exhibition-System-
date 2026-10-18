const crypto = require('crypto');
const Archive = require('../models/Archive');

// A stable id makes concurrent retries safe even before a compound index can
// be added to older databases that might already contain duplicate archives.
function archiveId(entityType, entityId) {
  const hex = crypto.createHash('sha256').update(`${entityType}:${entityId}`).digest('hex').slice(0, 24);
  return hex;
}

async function archiveOnce({ entityType, snapshot, deletedBy, session, artistRecoverUntil }) {
  const entityId = snapshot._id;
  const options = session ? { upsert: true, session, timestamps: false } : { upsert: true, timestamps: false };
  const archivedAt = new Date();
  try {
    const result = await Archive.updateOne(
      { entityType, entityId },
      { $setOnInsert: { _id: archiveId(entityType, entityId), entityType, entityId, snapshot, deletedBy, deletedAt: archivedAt, artistRecoverUntil: artistRecoverUntil || null, createdAt: archivedAt, updatedAt: archivedAt } },
      options,
    );
    return result.upsertedCount === 1;
  } catch (error) {
    // Two requests may both see no record before one wins the stable _id.
    if (error.code === 11000 && await Archive.exists({ entityType, entityId })) return false;
    throw error;
  }
}

module.exports = { archiveOnce, archiveId };
