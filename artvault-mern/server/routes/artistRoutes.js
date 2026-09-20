const express = require('express');
const {
  listArtists, getArtist, updateMyProfile, deleteMyAccount,
  listAdminArtists, updateArtistAsAdmin, deleteArtistAsAdmin, setArtistRole,
  setArtistStatus,
} = require('../controllers/artistController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', listArtists);
router.put('/me', requireAuth, updateMyProfile);
router.delete('/me', requireAuth, deleteMyAccount);
router.get('/admin', requireAuth, requireAdmin, listAdminArtists);
router.put('/admin/:id', requireAuth, requireAdmin, updateArtistAsAdmin);
router.put('/admin/:id/role', requireAuth, requireAdmin, setArtistRole);
router.put('/admin/:id/status', requireAuth, requireAdmin, setArtistStatus);
router.delete('/admin/:id', requireAuth, requireAdmin, deleteArtistAsAdmin);
router.get('/:id', getArtist);

module.exports = router;
