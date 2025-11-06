const { body, param, query } = require('express-validator');

const phoneRegex = /^[0-9+\-\s()]{7,20}$/;

const listUsersQuery = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('role').optional().isString().trim(),
  query('search').optional().isString().trim(),
  query('from').optional().isISO8601().toDate(),
  query('to').optional().isISO8601().toDate(),
];

const createUserValidator = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional({ nullable: true }).matches(phoneRegex),
  body('password').isLength({ min: 6 }),
  body('roles').optional({ nullable: true }).isArray().withMessage('roles must be array'),
  body('roles.*').optional().isString().trim(),
];

const updateUserValidator = [
  param('id').isInt({ min: 1 }).toInt(),
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional({ nullable: true }).matches(phoneRegex),
  body('password').optional().isLength({ min: 6 }),
  body('roles').optional().isArray(),
  body('roles.*').optional().isString().trim(),
];

module.exports = {
  listUsersQuery,
  createUserValidator,
  updateUserValidator,
};