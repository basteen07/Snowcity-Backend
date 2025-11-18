// bookingFlow.routes.js
const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/bookingFlow.controller');
const { requireAuth, optionalAuth } = require('../../middlewares/authMiddleware');
const { paymentLimiter } = require('../../middlewares/rateLimiter');

// Step 1 / 2: preview totals (no auth required)
router.post('/preview', ctrl.preview);

// Step 3: OTP send & verify (guest / logged-out users)
// send OTP (createIfNotExists for new users)
router.post('/otp/send', ctrl.sendOtp);

// verify OTP (returns token + optionally creates cart item if draft provided)
router.post('/otp/verify', ctrl.verifyOtp);

// Step 4: initiate payment (requires auth)
router.post('/initiate', requireAuth, paymentLimiter, ctrl.initiate);
router.post('/confirm', requireAuth, ctrl.confirm);

module.exports = router;
