const { body, param, query } = require('express-validator');

const listHolidaysQuery = [
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('upcoming').optional().isBoolean().toBoolean(),
];

const createHolidayValidator = [
  body('holiday_date').isISO8601().withMessage('holiday_date must be date'),
  body('description').optional({ nullable: true }).isLength({ min: 0, max: 255 }),
];

const updateHolidayValidator = [
  param('id').isInt({ min: 1 }).toInt(),
  body('holiday_date').optional().isISO8601(),
  body('description').optional({ nullable: true }).isLength({ min: 0, max: 255 }),
];

module.exports = {
  listHolidaysQuery,
  createHolidayValidator,
  updateHolidayValidator,
};