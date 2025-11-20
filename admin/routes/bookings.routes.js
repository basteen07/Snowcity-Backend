const router = require('express').Router();
const ctrl = require('../controllers/bookings.controller');
const perm = require('../middleware/permissionGuard');

const guard = (name, ...args) => {
  const fn = perm && typeof perm[name] === 'function' ? perm[name](...args) : (req, res, next) => next();
  return fn;
};

// Assert handlers exist (clear error if not)
const must = (name, fn) => {
  if (typeof fn !== 'function') throw new Error(`Admin bookings: handler ${name} is not a function`);
};
must('listBookings', ctrl.listBookings);
must('getBookingById', ctrl.getBookingById);
must('createManualBooking', ctrl.createManualBooking);
must('updateBooking', ctrl.updateBooking);
must('cancelBooking', ctrl.cancelBooking);
must('deleteBooking', ctrl.deleteBooking);
must('checkPayPhiStatusAdmin', ctrl.checkPayPhiStatusAdmin);
must('initiatePayPhiPaymentAdmin', ctrl.initiatePayPhiPaymentAdmin);
must('refundPayPhi', ctrl.refundPayPhi);

// List + read
router.get('/', guard('requirePermissions', 'bookings:read'), ctrl.listBookings);
router.get('/:id', guard('requirePermissions', 'bookings:read'), ctrl.getBookingById);

// Create/update/delete
router.post('/', guard('requirePermissions', 'bookings:write'), ctrl.createManualBooking);
router.put('/:id', guard('requirePermissions', 'bookings:write'), ctrl.updateBooking);
router.post('/:id/cancel', guard('requirePermissions', 'bookings:write'), ctrl.cancelBooking);
router.post('/:id/resend-ticket', guard('requirePermissions', 'bookings:write'), ctrl.resendTicket);
router.delete('/:id', guard('requirePermissions', 'bookings:write'), ctrl.deleteBooking);

// PayPhi (admin)
router.get('/:id/pay/payphi/status', guard('requirePermissions', 'bookings:read'), ctrl.checkPayPhiStatusAdmin);
router.post('/:id/pay/payphi/initiate', guard('requirePermissions', 'bookings:write'), ctrl.initiatePayPhiPaymentAdmin);
router.post('/:id/pay/payphi/refund', guard('requirePermissions', 'bookings:write'), ctrl.refundPayPhi);

module.exports = router;