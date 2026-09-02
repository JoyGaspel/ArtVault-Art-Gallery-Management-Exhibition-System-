const express = require('express');
const { listArchives, restoreArchive, permanentlyDeleteArchive } = require('../controllers/archiveController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/', listArchives);
router.post('/:id/restore', restoreArchive);
router.delete('/:id', permanentlyDeleteArchive);
module.exports = router;
