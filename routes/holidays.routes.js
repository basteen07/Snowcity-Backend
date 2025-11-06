const router = require('express').Router();
const { pool } = require('../config/db');

// Public list of holidays
router.get('/', async (req, res, next) => {
  try {
    const { from, to, upcoming } = req.query;
    const where = [];
    const params = [];
    let i = 1;

    if (upcoming === 'true') where.push(`holiday_date >= CURRENT_DATE`);
    if (from) {
      where.push(`holiday_date >= $${i++}::date`);
      params.push(from);
    }
    if (to) {
      where.push(`holiday_date <= $${i++}::date`);
      params.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT holiday_id, holiday_date, description
       FROM holidays
       ${whereSql}
       ORDER BY holiday_date ASC`,
      params
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;