const express = require('express');
const {
  listArtworks,
  listMyArtworks,
  getArtworkImage,
  createArtwork,
  getArtwork,
  updateArtwork,
  deleteArtwork,
  loadArtworkAndAuthorize,
} = require('../controllers/artworkController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', listArtworks);                                  // GET  /api/artworks
router.post('/', requireAuth, createArtwork);                    // POST /api/artworks
router.get('/mine', requireAuth, listMyArtworks);                // GET /api/artworks/mine
router.get('/:id/image', getArtworkImage);                       // GET  /api/artworks/:id/image
router.get('/:id', getArtwork);                                  // GET  /api/artworks/:id
router.put('/:id', requireAuth, loadArtworkAndAuthorize, updateArtwork);    // PUT    /api/artworks/:id
router.delete('/:id', requireAuth, loadArtworkAndAuthorize, deleteArtwork); // DELETE /api/artworks/:id

module.exports = router;
