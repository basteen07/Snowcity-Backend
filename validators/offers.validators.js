const { body, param, query } = require('express-validator');

const createOfferValidator = [
  body('title').isLength({ min: 2, max: 100 }),
  body('description').optional({ nullable: true }).isString(),
  body('image_url').optional({ nullable: true }).isURL(),
  body('rule_type').optional({ nullable: true }).isIn(['holiday', 'happy_hour', 'weekday_special']),
  body('discount_percent').optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body('valid_from').optional({ nullable: true }).isISO8601(),
  body('valid_to')
    .optional({ nullable: true })
    .isISO8601()
    .custom((v, { req }) => {
      if (v && req.body.valid_from && new Date(v) < new Date(req.body.valid_from))
        throw new Error('valid_to must be on/after valid_from');
      return true;
    }),
  body('active').optional().isBoolean().toBoolean(),
];

const updateOfferValidator = [param('id').isInt({ min: 1 }).toInt(), ...createOfferValidator.map((r) => r.optional())];

const listOffersQuery = [
  query('active').optional().isBoolean().toBoolean(),
  query('rule_type').optional().isIn(['holiday', 'happy_hour', 'weekday_special']),
  query('date').optional().isISO8601(),
  query('q').optional().isString().trim(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

module.exports = {
  createOfferValidator,
  updateOfferValidator,
  listOffersQuery,
};