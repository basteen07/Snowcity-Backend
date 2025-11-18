const router = require('express').Router();

const bookingsCtrl = require('../controllers/bookings.controller');
const { requireAuth } = require('../../middlewares/authMiddleware');
const { defaultLimiter, paymentLimiter } = require('../../middlewares/rateLimiter');

// Rate-limit all booking endpoints in this router
router.use(defaultLimiter);

// Current user's bookings
router.get('/', requireAuth, bookingsCtrl.listMyBookings);
router.get('/:id', requireAuth, bookingsCtrl.getMyBookingById);

// Create booking(s)
router.post('/', requireAuth, bookingsCtrl.createBooking);

// PayPhi helpers
router.post('/:id/pay/payphi/initiate', requireAuth, paymentLimiter, bookingsCtrl.initiatePayPhiPayment);
router.get('/:id/pay/payphi/status', requireAuth, bookingsCtrl.checkPayPhiStatus);

module.exports = router;