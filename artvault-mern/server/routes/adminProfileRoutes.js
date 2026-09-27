const express = require('express');
const mongoose = require('mongoose');
const AdminProfile = require('../models/AdminProfile');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Read-only directory for administrator tooling. Authentication and role
// enforcement still come from the original Artist account.
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const profiles = await AdminProfile.find({ status: mongoose.trusted({ $ne: 'inactive' }) })
      .sort({ role: 1, createdAt: -1 })
      .populate('artistId', 'name email role status specializations bio')
      .lean();
    res.json({ profiles });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
