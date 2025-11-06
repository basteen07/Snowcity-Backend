const { body, param, query } = require('express-validator');

const listSlotsQuery = [
  query('attraction_id').optional().isInt({ min: 1 }).toInt(),
  query('date').optional().isISO8601().withMessage('date must be YYYY-MM-DD'),
  query('start_date').optional().isISO8601(),
  query('end_date').optional().isISO8601(),
];

const createSlotValidator = [
  body('attraction_id').isInt({ min: 1 }).toInt(),
  body('start_date').isISO8601().withMessage('start_date must be YYYY-MM-DD'),
  body('end_date').isISO8601().withMessage('end_date must be YYYY-MM-DD'),
  body('start_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('start_time HH:mm or HH:mm:ss'),
  body('end_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('end_time HH:mm or HH:mm:ss'),
  body('capacity').isInt({ min: 0 }).toInt(),
  body('available').optional().isBoolean().toBoolean(),
];

const updateSlotValidator = [
  param('id').isInt({ min: 1 }).toInt(),
  body('attraction_id').optional().isInt({ min: 1 }).toInt(),
  body('start_date').optional().isISO8601(),
  body('end_date').optional().isISO8601(),
  body('start_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('end_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('capacity').optional().isInt({ min: 0 }).toInt(),
  body('available').optional().isBoolean().toBoolean(),
];

module.exports = {
  listSlotsQuery,
  createSlotValidator,
  updateSlotValidator,
};