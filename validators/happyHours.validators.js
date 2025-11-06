const { body, param, query } = require('express-validator');

const listHappyHoursQuery = [query('attraction_id').optional().isInt({ min: 1 }).toInt()];

const createHappyHourValidator = [
  body('attraction_id').isInt({ min: 1 }).toInt(),
  body('start_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('start_time HH:mm or HH:mm:ss'),
  body('end_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('end_time HH:mm or HH:mm:ss'),
  body('discount_percent').optional().isFloat({ min: 0, max: 100 }).toFloat(),
];

const updateHappyHourValidator = [
  param('id').isInt({ min: 1 }).toInt(),
  body('attraction_id').optional().isInt({ min: 1 }).toInt(),
  body('start_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('end_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('discount_percent').optional().isFloat({ min: 0, max: 100 }).toFloat(),
];

module.exports = {
  listHappyHoursQuery,
  createHappyHourValidator,
  updateHappyHourValidator,
};