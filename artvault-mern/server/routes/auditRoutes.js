const express = require('express');
const AuditLog = require('../models/AuditLog');
const Artwork = require('../models/Artwork');
const mongoose = require('mongoose');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10) || 50;
    const limit = Math.min(100, Math.max(1, requestedLimit));
    const filter = req.user.role === 'sub_admin' ? { actorRole: 'artist' } : {};
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actor', 'name email role')
      .lean();
    if (req.user.role === 'sub_admin') {
      const artworkIds = logs.filter((log) => log.entityType === 'artwork').map((log) => log.entityId);
      const privateWorks = await Artwork.find({ _id: mongoose.trusted({ $in: artworkIds }), visibility: 'private' }).select('_id').lean();
      const hidden = new Set(privateWorks.map((work) => String(work._id)));
      return res.json({ logs: logs.filter((log) => log.details?.visibility !== 'private' && !(log.entityType === 'artwork' && hidden.has(String(log.entityId)))) });
    }
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
