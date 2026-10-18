const express = require('express');
const {
  listArtworks,
  listMyArtworks,
  listVaultArtworks,
  listMyPortfolio,
  authorizeArtworkRead,
  setArtworkVisibility,
  getArtworkImage,
  getArtworkThumbnail,
  getOwnershipEvidence,
  createArtwork,
  getArtwork,
  updateArtwork,
  syncArtworkMetadata,
  deleteArtwork,
  loadArtworkAndAuthorize,
} = require('../controllers/artworkController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', listArtworks);                                  // GET  /api/artworks
router.post('/', requireAuth, createArtwork);                    // POST /api/artworks
router.get('/mine', requireAuth, requireRole('artist'), listMyArtworks); // GET /api/artworks/mine
router.get('/mine/portfolio', requireAuth, requireRole('artist'), listMyPortfolio);
router.get('/vault', requireAuth, requireRole('artist'), listVaultArtworks);
router.get('/admin/vault', requireAuth, requireRole('sub_admin', 'main_admin'), listVaultArtworks);
router.get('/:id/image', authorizeArtworkRead, getArtworkImage);
router.get('/:id/thumbnail', authorizeArtworkRead, getArtworkThumbnail);
router.get('/:id/ownership-evidence', requireAuth, getOwnershipEvidence);
router.get('/:id', authorizeArtworkRead, getArtwork);
router.patch('/:id/visibility', requireAuth, setArtworkVisibility);
router.patch('/:id/sync-metadata', requireAuth, requireRole('artist'), syncArtworkMetadata);
router.put('/:id', requireAuth, loadArtworkAndAuthorize, updateArtwork);    // PUT    /api/artworks/:id
router.delete('/:id', requireAuth, loadArtworkAndAuthorize, deleteArtwork); // DELETE /api/artworks/:id

module.exports = router;
