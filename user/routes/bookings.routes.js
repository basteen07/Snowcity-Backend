const router = require('express').Router();
const ctrl = require('../user/controllers/bookings.controller');
const { requireAuth, optionalAuth } = require('../middlewares/authMiddleware');
const { paymentLimiter } = require('../middlewares/rateLimiter');

router.get('/', requireAuth, ctrl.listMyBookings);
router.get('/:id', requireAuth, ctrl.getMyBookingById);

// Create booking - optional auth (supports guest bookings)
router.post('/', optionalAuth, ctrl.createBooking);

// OTP flow for guest bookings
router.post('/otp/send', ctrl.sendBookingOtp);
router.post('/otp/verify', ctrl.verifyBookingOtp);

// PayPhi
router.post('/:id/pay/payphi/initiate', requireAuth, paymentLimiter, ctrl.initiatePayPhiPayment);
router.get('/:id/pay/payphi/status', requireAuth, ctrl.checkPayPhiStatus);

module.exports = router;