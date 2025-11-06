const { body, param } = require('express-validator');

const createBookingValidator = [
  body('attraction_id').isInt({ min: 1 }).toInt(),
  body('slot_id').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  body('booking_date').optional().isISO8601().withMessage('booking_date must be YYYY-MM-DD'),
  body('addons').optional({ nullable: true }).isArray(),
  body('addons.*.addon_id').isInt({ min: 1 }).toInt(),
  body('addons.*.quantity').optional().isInt({ min: 1 }).toInt(),
  body('coupon_code').optional({ nullable: true }).isLength({ min: 1, max: 50 }),
  body('payment_mode').optional().isIn(['Online', 'Offline']),
];

const cancelBookingValidator = [param('id').isInt({ min: 1 }).toInt()];

const createRazorpayOrderValidator = [param('id').isInt({ min: 1 }).toInt()];

const verifyRazorpayPaymentValidator = [
  param('id').isInt({ min: 1 }).toInt(),
  body('order_id').isString().notEmpty(),
  body('payment_id').isString().notEmpty(),
  body('signature').isString().notEmpty(),
];

const initiatePhonePeValidator = [
  param('id').isInt({ min: 1 }).toInt(),
  body('mobileNumber').isString().isLength({ min: 8, max: 15 }),
];

const phonePeStatusValidator = [param('id').isInt({ min: 1 }).toInt()];

module.exports = {
  createBookingValidator,
  cancelBookingValidator,
  createRazorpayOrderValidator,
  verifyRazorpayPaymentValidator,
  initiatePhonePeValidator,
  phonePeStatusValidator,
};