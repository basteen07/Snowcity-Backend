const router = require('express').Router();
const ctrl = require('../user/controllers/auth.controller');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/authMiddleware');
const { authLimiter, otpLimiter } = require('../middlewares/rateLimiter');
const {
  registerValidator,
  loginValidator,
  sendOtpValidator,
  verifyOtpValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} = require('../validators/auth.validators');

// Register
router.post('/register', authLimiter, validate(registerValidator), ctrl.register);

// Login / Logout
router.post('/login', authLimiter, validate(loginValidator), ctrl.login);
router.post('/logout', requireAuth, ctrl.logout);

// OTP
router.post('/otp/send', otpLimiter, validate(sendOtpValidator), ctrl.sendOtp);
router.post('/otp/verify', otpLimiter, validate(verifyOtpValidator), ctrl.verifyOtp);

// Password reset via email code
router.post('/password/forgot', authLimiter, validate(forgotPasswordValidator), ctrl.forgotPassword);
router.post('/password/reset', authLimiter, validate(resetPasswordValidator), ctrl.resetPassword);

module.exports = router;