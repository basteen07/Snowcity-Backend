const router = require('express').Router();
const { pool } = require('../config/db');

// Public happy hours
router.get('/', async (req, res, next) => {
  try {
    const { attraction_id } = req.query;
    const params = [];
    let where = '';
    if (attraction_id) {
      where = 'WHERE hh.attraction_id = $1';
      params.push(Number(attraction_id));
    }

    const { rows } = await pool.query(
      `
      SELECT
        hh.hh_id, hh.attraction_id, a.title AS attraction_title,
        hh.start_time, hh.end_time, hh.discount_percent
      FROM happy_hours hh
      JOIN attractions a ON a.attraction_id = hh.attraction_id
      ${where}
      ORDER BY a.title ASC, hh.start_time ASC
      `,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;