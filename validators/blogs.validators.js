const { body, param, query } = require('express-validator');

const createBlogValidator = [
  body('title').isLength({ min: 2, max: 150 }),
  body('slug').isLength({ min: 2, max: 100 }).matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body('content').optional({ nullable: true }).isString(),
  body('image_url').optional({ nullable: true }).isURL(),
  body('author').optional({ nullable: true }).isLength({ min: 2, max: 100 }),
  body('active').optional().isBoolean().toBoolean(),
];

const updateBlogValidator = [param('id').isInt({ min: 1 }).toInt(), ...createBlogValidator.map((r) => r.optional())];

const listBlogsQuery = [
  query('active').optional().isBoolean().toBoolean(),
  query('q').optional().isString().trim(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

module.exports = {
  createBlogValidator,
  updateBlogValidator,
  listBlogsQuery,
};