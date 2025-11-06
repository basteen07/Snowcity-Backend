const { body, param } = require('express-validator');

const createAddonValidator = [
  body('title').isLength({ min: 2, max: 100 }),
  body('description').optional({ nullable: true }).isString(),
  body('price').isFloat({ min: 0 }).toFloat(),
  body('discount_percent').optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body('image_url').optional({ nullable: true }).isURL(),
  body('active').optional().isBoolean().toBoolean(),
];

const updateAddonValidator = [
  param('id').isInt({ min: 1 }).toInt(),
  ...createAddonValidator.map((r) => r.optional({ nullable: true })),
];

module.exports = {
  createAddonValidator,
  updateAddonValidator,
};