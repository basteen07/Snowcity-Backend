const { body } = require('express-validator');

const phoneRegex = /^[0-9+\-\s()]{7,20}$/;

const registerValidator = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('name must be 2-100 chars'),
  body('email').isEmail().withMessage('valid email is required').normalizeEmail(),
  body('password').optional({ nullable: true }).isLength({ min: 6 }).withMessage('password must be at least 6 chars (optional for regular users)'),
  body('phone').optional({ nullable: true }).matches(phoneRegex).withMessage('invalid phone'),
];

const loginValidator = [
  body('email').isEmail().withMessage('valid email is required').normalizeEmail(),
  body('password').optional({ nullable: true }).isLength({ min: 6 }).withMessage('password must be at least 6 chars (optional for regular users, required for admin)'),
];

const sendOtpValidator = [
  body('user_id').optional().isInt({ min: 1 }).toInt(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().matches(phoneRegex),
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('name must be 2-100 chars (required if createIfNotExists is true)'),
  body('channel').optional().isIn(['sms', 'email']).withMessage('channel must be sms or email'),
  body('createIfNotExists').optional().isBoolean().withMessage('createIfNotExists must be boolean'),
  // Custom validation: at least one of user_id, email, or phone must be provided
  body().custom((value) => {
    if (!value.user_id && !value.email && !value.phone) {
      throw new Error('At least one of user_id, email, or phone must be provided');
    }
    return true;
  }),
];

const verifyOtpValidator = [
  body('user_id').optional().isInt({ min: 1 }).toInt(),
  body('otp').isLength({ min: 4, max: 10 }).withMessage('otp length invalid').isNumeric().withMessage('otp must be numeric'),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().matches(phoneRegex),
  // Custom validation: if user_id is not provided, at least one of email or phone must be provided
  body().custom((value) => {
    if (!value.user_id && !value.email && !value.phone) {
      throw new Error('At least one of user_id, email, or phone must be provided');
    }
    return true;
  }),
];

const forgotPasswordValidator = [body('email').isEmail().withMessage('valid email is required').normalizeEmail()];

const resetPasswordValidator = [
  body('email').isEmail().withMessage('valid email is required').normalizeEmail(),
  body('code').isLength({ min: 4, max: 10 }).withMessage('code length invalid').isNumeric().withMessage('code must be numeric'),
  body('newPassword').isLength({ min: 6 }).withMessage('newPassword must be at least 6 chars'),
];

module.exports = {
  registerValidator,
  loginValidator,
  sendOtpValidator,
  verifyOtpValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
};