const { body, param, query } = require('express-validator');

const listNotificationsQuery = [
  query('status').optional().isIn(['sent', 'failed', 'pending']),
  query('channel').optional().isIn(['email', 'whatsapp']),
  query('user_id').optional().isInt({ min: 1 }).toInt(),
  query('booking_id').optional().isInt({ min: 1 }).toInt(),
  query('q').optional().isString().trim(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const createNotificationValidator = [
  body('user_id').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  body('booking_id').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  body('channel').isIn(['email', 'whatsapp']),
  body('message').isString().notEmpty(),
  body('sendNow').optional().isBoolean().toBoolean(),
  body('to').optional({ nullable: true }).isString().trim(),
  body('subject').optional({ nullable: true }).isString().trim(),
];

const resendNotificationValidator = [param('id').isInt({ min: 1 }).toInt(), body('to').optional().isString(), body('subject').optional().isString()];

module.exports = {
  listNotificationsQuery,
  createNotificationValidator,
  resendNotificationValidator,
}; 