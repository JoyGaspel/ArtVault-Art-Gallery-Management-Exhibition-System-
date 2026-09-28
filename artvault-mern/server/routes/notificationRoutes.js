const express = require('express');
const {
  listMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notificationController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const requireArtist = requireRole('artist');

router.get('/', requireAuth, requireArtist, listMyNotifications);
router.get('/unread-count', requireAuth, requireArtist, getUnreadCount);
router.patch('/read-all', requireAuth, requireArtist, markAllNotificationsRead);
router.patch('/:id/read', requireAuth, requireArtist, markNotificationRead);

module.exports = router;
