const { pool } = require('../../config/db');

exports.listHolidays = async (req, res, next) => {
  try {
    const { from, to, upcoming } = req.query;
    const where = [];
    const params = [];
    let i = 1;

    if (upcoming === 'true') {
      where.push(`holiday_date >= CURRENT_DATE`);
    }
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
      `SELECT holiday_id, holiday_date, description, created_at, updated_at
       FROM holidays
       ${whereSql}
       ORDER BY holiday_date ASC`,
      params
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.createHoliday = async (req, res, next) => {
  try {
    const { holiday_date, description = null } = req.body;
    if (!holiday_date) return res.status(400).json({ error: 'holiday_date is required (YYYY-MM-DD)' });

    const { rows } = await pool.query(
      `INSERT INTO holidays (holiday_date, description)
       VALUES ($1::date, $2)
       RETURNING holiday_id, holiday_date, description, created_at, updated_at`,
      [holiday_date, description]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Holiday date already exists' });
    }
    next(err);
  }
};

exports.updateHoliday = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { holiday_date, description } = req.body;

    const fields = [];
    const params = [];
    let i = 1;

    if (holiday_date != null) {
      fields.push(`holiday_date = $${i++}::date`);
      params.push(holiday_date);
    }
    if (description !== undefined) {
      fields.push(`description = $${i++}`);
      params.push(description);
    }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    const { rows } = await pool.query(
      `UPDATE holidays SET ${fields.join(', ')}, updated_at = NOW()
       WHERE holiday_id = $${i}
       RETURNING holiday_id, holiday_date, description, created_at, updated_at`,
      [...params, id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Holiday not found' });
    res.json(row);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Holiday date already exists' });
    }
    next(err);
  }
};

exports.deleteHoliday = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rowCount } = await pool.query(`DELETE FROM holidays WHERE holiday_id = $1`, [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Holiday not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};