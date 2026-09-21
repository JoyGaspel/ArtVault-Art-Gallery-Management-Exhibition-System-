const express = require('express');
const {
  listMyEntries,
  listReviewEntries,
  submitEntry,
  withdrawEntry,
  decideEntry,
} = require('../controllers/exhibitEntryController');
const { requireAuth, requireAdmin, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/my', requireAuth, requireRole('artist'), listMyEntries);
router.get('/review', requireAuth, requireAdmin, listReviewEntries);
router.post('/', requireAuth, requireRole('artist'), submitEntry);
router.delete('/:id', requireAuth, requireRole('artist'), withdrawEntry);
router.put('/:id/decision', requireAuth, requireAdmin, decideEntry);

module.exports = router;
