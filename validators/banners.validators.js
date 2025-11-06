const { body, param, query } = require('express-validator');

const createBannerValidator = [
  body('web_image').optional({ nullable: true }).isURL(),
  body('mobile_image').optional({ nullable: true }).isURL(),
  body('title').optional({ nullable: true }).isLength({ min: 0, max: 100 }),
  body('description').optional({ nullable: true }).isString(),
  body('linked_attraction_id').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  body('linked_offer_id').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  body('active').optional().isBoolean().toBoolean(),
];

const updateBannerValidator = [param('id').isInt({ min: 1 }).toInt(), ...createBannerValidator.map((r) => r.optional())];

const listBannersQuery = [
  query('active').optional().isBoolean().toBoolean(),
  query('attraction_id').optional().isInt({ min: 1 }).toInt(),
  query('offer_id').optional().isInt({ min: 1 }).toInt(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

module.exports = {
  createBannerValidator,
  updateBannerValidator,
  listBannersQuery,
};