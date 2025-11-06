const { query } = require('express-validator');

const analyticsQuery = [
  query('attraction_id').optional().isInt({ min: 1 }).toInt(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('granularity').optional().isIn(['day', 'week', 'month']),
];

module.exports = {
  analyticsQuery,
};