const express = require('express');
const {
  listArtworks,
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
router.get('/:id', getArtwork);                                  // GET  /api/artworks/:id
router.put('/:id', requireAuth, loadArtworkAndAuthorize, updateArtwork);    // PUT    /api/artworks/:id
router.delete('/:id', requireAuth, loadArtworkAndAuthorize, deleteArtwork); // DELETE /api/artworks/:id

module.exports = router;
