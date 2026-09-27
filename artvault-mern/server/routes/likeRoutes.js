const express = require('express');
const { requireAuth, requireAdmin, requireRole } = require('../middleware/auth');
const { likeArtwork, unlikeArtwork, getMyLikeStatus, listLikes, removeLike } = require('../controllers/likeController');

const router = express.Router();

router.post('/artworks/:id/likes', requireAuth, requireRole('artist'), likeArtwork);
router.delete('/artworks/:id/likes', requireAuth, requireRole('artist'), unlikeArtwork);
router.get('/artworks/:id/likes/me', requireAuth, requireRole('artist'), getMyLikeStatus);
router.get('/likes', requireAuth, requireAdmin, listLikes);
router.delete('/likes/:id', requireAuth, requireRole('main_admin'), removeLike);

module.exports = router;
