const { body, param, query } = require('express-validator');

const listComboSlotsQuery = [
  query('combo_id').optional().isInt({ min: 1 }).toInt(),
  query('date').optional().isISO8601().withMessage('date must be YYYY-MM-DD'),
  query('start_date').optional().isISO8601(),
  query('end_date').optional().isISO8601(),
];

const createComboSlotValidator = [
  body('combo_id').isInt({ min: 1 }).toInt(),
  body('start_date').isISO8601().withMessage('start_date must be YYYY-MM-DD'),
  body('end_date').isISO8601().withMessage('end_date must be YYYY-MM-DD'),
  body('start_time')
    .matches(/^(0[1-9]|1[0-2])\.(0[0-9]|[1-5][0-9])(am|pm)$/i)
    .withMessage('start_time must be in 12-hour format e.g. 01.00pm'),
  body('end_time')
    .matches(/^(0[1-9]|1[0-2])\.(0[0-9]|[1-5][0-9])(am|pm)$/i)
    .withMessage('end_time must be in 12-hour format e.g. 02.30pm'),
  body('capacity').isInt({ min: 0 }).toInt(),
  body('price').optional({ nullable: true }).isFloat({ min: 0 }).toFloat(),
  body('available').optional().isBoolean().toBoolean(),
];

const updateComboSlotValidator = [
  param('id').isInt({ min: 1 }).toInt(),
  body('combo_id').optional().isInt({ min: 1 }).toInt(),
  body('start_date').optional().isISO8601(),
  body('end_date').optional().isISO8601(),
  body('start_time')
    .optional()
    .matches(/^(0[1-9]|1[0-2])\.(0[0-9]|[1-5][0-9])(am|pm)$/i),
  body('end_time')
    .optional()
    .matches(/^(0[1-9]|1[0-2])\.(0[0-9]|[1-5][0-9])(am|pm)$/i),
  body('capacity').optional().isInt({ min: 0 }).toInt(),
  body('price').optional({ nullable: true }).isFloat({ min: 0 }).toFloat(),
  body('available').optional().isBoolean().toBoolean(),
];

module.exports = {
  listComboSlotsQuery,
  createComboSlotValidator,
  updateComboSlotValidator,
};
