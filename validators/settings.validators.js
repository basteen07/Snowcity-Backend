const { body, param } = require('express-validator');

const upsertSettingValidator = [
  body('key_name').optional().isString().trim().isLength({ min: 1, max: 255 }),
  body('key_value').optional({ nullable: true }).isString(),
];

const upsertSettingByKeyValidator = [
  param('key').isString().trim().isLength({ min: 1, max: 255 }),
  body('key_value').isString(),
];

module.exports = {
  upsertSettingValidator,
  upsertSettingByKeyValidator,
};