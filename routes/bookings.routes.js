const express = require('express');
const router = express.Router();

const ctrl = require('../user/controllers/bookings.controller');
const { requireAuth } = require('../middlewares/authMiddleware');
const { paymentLimiter } = require('../middlewares/rateLimiter');

function must(name, fn) {
  if (typeof fn !== 'function') throw new Error(`User bookings: handler ${name} is not a function`);
}
must('listMyBookings', ctrl.listMyBookings);
must('getMyBookingById', ctrl.getMyBookingById);
must('createBooking', ctrl.createBooking);
must('initiatePayPhiPayment', ctrl.initiatePayPhiPayment);
must('checkPayPhiStatus', ctrl.checkPayPhiStatus);

// User bookings
router.get('/', requireAuth, ctrl.listMyBookings);
router.get('/:id', requireAuth, ctrl.getMyBookingById);

// Create booking (for testing, only require auth)
router.post('/', requireAuth, ctrl.createBooking);

// PayPhi
router.post('/:id/pay/payphi/initiate', requireAuth, paymentLimiter, ctrl.initiatePayPhiPayment);
router.get('/:id/pay/payphi/status', requireAuth, ctrl.checkPayPhiStatus);

module.exports = router;