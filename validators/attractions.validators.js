const { body, param, query } = require('express-validator');

const listAttractionsQuery = [
  query('search').optional().isString().trim(),
  query('active').optional().isBoolean().toBoolean(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const createAttractionValidator = [
  body('title').isLength({ min: 2, max: 150 }).withMessage('title 2-150 chars'),
  body('slug').optional({ nullable: true }).isString().trim(),
  body('description').optional({ nullable: true }).isString(),
  body('image_url').optional({ nullable: true }).isURL().withMessage('image_url must be valid URL'),
  body('gallery').optional({ nullable: true }).isArray(),
  body('gallery.*').optional().isURL(),
  body('base_price').optional().isFloat({ min: 0 }).toFloat(),
  body('price_per_hour').optional().isFloat({ min: 0 }).toFloat(),
  body('discount_percent').optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body('active').optional().isBoolean().toBoolean(),
  body('badge').optional({ nullable: true }).isString().trim(),
  body('video_url').optional({ nullable: true }).isURL(),
  body('slot_capacity').optional().isInt({ min: 0 }).toInt(),
];

const updateAttractionValidator = [
  param('id').isInt({ min: 1 }).toInt(),
  ...createAttractionValidator.map((r) => r.optional({ nullable: true })),
];

module.exports = {
  listAttractionsQuery,
  createAttractionValidator,
  updateAttractionValidator,
};