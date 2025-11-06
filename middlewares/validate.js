const { validationResult } = require('express-validator');

function validate(rules) {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(rules.map((rule) => rule.run(req)));

    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const errors = result
      .array({ onlyFirstError: true })
      .map((e) => ({ field: e.param, message: e.msg, value: e.value }));

    return res.status(422).json({ error: 'Validation error', details: errors });
  };
}

module.exports = validate;