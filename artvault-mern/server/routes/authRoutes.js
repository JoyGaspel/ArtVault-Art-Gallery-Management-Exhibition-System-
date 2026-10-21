const express = require('express');
const { signup, login, loginSuccess, me } = require('../controllers/authController');
const { requireAuth, requireRecoveryAuth } = require('../middleware/auth');
const backup = require('../controllers/backupSecurityController');

const router = express.Router();
const jwt = require('jsonwebtoken');
const RevokedSession = require('../models/RevokedSession');
const { tokenHash } = require('../utils/sessionSecurity');

router.post('/signup', signup);
router.post('/login', login);
router.post('/login-success', requireAuth, loginSuccess);
router.get('/me', requireAuth, me);
router.get('/backup-codes', requireAuth, backup.getStatus);
router.post('/backup-codes/otp', requireAuth, backup.sendOtp);
router.post('/backup-codes/change', requireAuth, backup.change);
router.post('/backup-codes/redeem', requireRecoveryAuth, backup.recover);
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    // requireAuth has already verified this token before its expiry is read.
    const claims = jwt.decode(req.authToken);
    const expiresAt = new Date((claims.exp || Math.floor(Date.now() / 1000) + 3600) * 1000);
    await RevokedSession.updateOne({ tokenHash: tokenHash(req.authToken) }, { $setOnInsert: { expiresAt } }, { upsert: true });
    res.set('Cache-Control', 'no-store');
    res.json({ message: 'Session signed out.' });
  } catch (error) { next(error); }
});

module.exports = router;
