const express = require('express');
const {
  listArtists, getArtist, getArtistAvatar, updateMyProfile, requestDeletionCode, deleteMyAccount,
  listAdminArtists, deleteArtistAsAdmin, setArtistRole,
  setArtistStatus,
} = require('../controllers/artistController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.post('/admin/:id/role/otp', requireAuth, requireAdmin, require('../controllers/artistController').requestRoleChangeOtp);

router.get('/', listArtists);
router.get('/:id/avatar', getArtistAvatar);
router.put('/me', requireAuth, updateMyProfile);
router.post('/me/deletion-code', requireAuth, requestDeletionCode);
router.delete('/me', requireAuth, deleteMyAccount);
router.get('/admin', requireAuth, requireAdmin, listAdminArtists);
router.put('/admin/:id/role', requireAuth, requireAdmin, setArtistRole);
router.put('/admin/:id/status', requireAuth, requireAdmin, setArtistStatus);
router.delete('/admin/:id', requireAuth, requireAdmin, deleteArtistAsAdmin);
router.get('/:id', getArtist);

module.exports = router;
