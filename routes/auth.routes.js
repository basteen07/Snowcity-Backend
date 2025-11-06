const router = require('express').Router();
const ctrl = require('../user/controllers/auth.controller');
const profileCtrl = require('../user/controllers/profile.controller');
const { requireAuth } = require('../middlewares/authMiddleware');
const { authLimiter, otpLimiter } = require('../middlewares/rateLimiter');

// Auth
router.post('/register', authLimiter, ctrl.register);
router.post('/login', authLimiter, ctrl.login);
router.post('/logout', requireAuth, ctrl.logout);
const express = require('express');



// Ensure JSON body parsing for these routes even if global parser is missing
router.use(express.json());

// Auth
router.post('/login', authLimiter, ctrl.login);
router.post('/register', authLimiter, ctrl.register);


// OTP
router.post('/otp/send', otpLimiter, ctrl.sendOtp);
router.post('/otp/verify', otpLimiter, ctrl.verifyOtp);

// Password
router.post('/password/forgot', authLimiter, ctrl.forgotPassword);
router.post('/password/reset', authLimiter, ctrl.resetPassword);

// Profile (current user)
router.get('/me', requireAuth, profileCtrl.getProfile);
router.patch('/me', requireAuth, profileCtrl.updateProfile);

module.exports = router;