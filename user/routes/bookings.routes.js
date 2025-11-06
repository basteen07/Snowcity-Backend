const router = require('express').Router();
const ctrl = require('../user/controllers/bookings.controller');
const { requireAuth, requireVerified } = require('../middlewares/authMiddleware');
const { paymentLimiter } = require('../middlewares/rateLimiter');

router.get('/', requireAuth, ctrl.listMyBookings);
router.get('/:id', requireAuth, ctrl.getMyBookingById);

router.post('/', requireVerified, ctrl.createBooking);

// PayPhi
router.post('/:id/pay/payphi/initiate', requireAuth, paymentLimiter, ctrl.initiatePayPhiPayment);
router.get('/:id/pay/payphi/status', requireAuth, ctrl.checkPayPhiStatus);

module.exports = router;