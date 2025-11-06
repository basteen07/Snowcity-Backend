const { body, param } = require('express-validator');

const createComboValidator = [
  body('attraction_1_id').isInt({ min: 1 }).toInt(),
  body('attraction_2_id').isInt({ min: 1 }).toInt().custom((v, { req }) => {
    if (Number(v) === Number(req.body.attraction_1_id)) throw new Error('attraction_2_id must differ from attraction_1_id');
    return true;
  }),
  body('combo_price').isFloat({ min: 0 }).toFloat(),
  body('discount_percent').optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body('active').optional().isBoolean().toBoolean(),
];

const updateComboValidator = [
  param('id').isInt({ min: 1 }).toInt(),
  body('attraction_1_id').optional().isInt({ min: 1 }).toInt(),
  body('attraction_2_id')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .custom((v, { req }) => {
      const a1 = req.body.attraction_1_id;
      if (a1 != null && Number(v) === Number(a1)) throw new Error('attraction_2_id must differ from attraction_1_id');
      return true;
    }),
  body('combo_price').optional().isFloat({ min: 0 }).toFloat(),
  body('discount_percent').optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body('active').optional().isBoolean().toBoolean(),
];

module.exports = {
  createComboValidator,
  updateComboValidator,
};