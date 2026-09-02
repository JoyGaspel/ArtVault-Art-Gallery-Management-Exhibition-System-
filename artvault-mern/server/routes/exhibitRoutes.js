const express = require('express');
const {
  listExhibits,
  getExhibit,
  createExhibit,
  updateExhibit,
  deleteExhibit,
} = require('../controllers/exhibitController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', listExhibits);
router.get('/:id', getExhibit);
router.post('/', requireAuth, requireAdmin, createExhibit);
router.put('/:id', requireAuth, requireAdmin, updateExhibit);
router.delete('/:id', requireAuth, requireAdmin, deleteExhibit);

module.exports = router;
