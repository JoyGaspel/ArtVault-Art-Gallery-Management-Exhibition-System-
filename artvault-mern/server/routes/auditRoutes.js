const express = require('express');
const AuditLog = require('../models/AuditLog');
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
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
