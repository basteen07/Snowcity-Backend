const { pool } = require('../../config/db');

function overlapExistsQuery(excludeId = false) {
  // Overlap if existing.start < new_end AND existing.end > new_start
  return `
    SELECT 1
    FROM happy_hours
    WHERE attraction_id = $1
      AND start_time < $3::time
      AND end_time > $2::time
      ${excludeId ? 'AND hh_id <> $4' : ''}
    LIMIT 1
  `;
}

exports.listHappyHours = async (req, res, next) => {
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
        hh.start_time, hh.end_time, hh.discount_percent,
        hh.created_at, hh.updated_at
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
};

exports.getHappyHourById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `
      SELECT
        hh.hh_id, hh.attraction_id, a.title AS attraction_title,
        hh.start_time, hh.end_time, hh.discount_percent,
        hh.created_at, hh.updated_at
      FROM happy_hours hh
      JOIN attractions a ON a.attraction_id = hh.attraction_id
      WHERE hh.hh_id = $1
      `,
      [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Happy hour not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.createHappyHour = async (req, res, next) => {
  try {
    const { attraction_id, start_time, end_time, discount_percent = 0 } = req.body;
    if (!attraction_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'attraction_id, start_time, end_time are required' });
    }

    // Check overlap
    const ov = await pool.query(overlapExistsQuery(false), [Number(attraction_id), start_time, end_time]);
    if (ov.rows[0]) {
      return res.status(409).json({ error: 'Overlapping happy hour exists for this attraction/time range' });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO happy_hours (attraction_id, start_time, end_time, discount_percent)
      VALUES ($1, $2::time, $3::time, $4)
      RETURNING hh_id, attraction_id, start_time, end_time, discount_percent, created_at, updated_at
      `,
      [Number(attraction_id), start_time, end_time, Number(discount_percent)]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.updateHappyHour = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { attraction_id, start_time, end_time, discount_percent } = req.body;

    // Load existing for defaults and attraction id if not provided
    const currentRes = await pool.query(`SELECT * FROM happy_hours WHERE hh_id = $1`, [id]);
    const current = currentRes.rows[0];
    if (!current) return res.status(404).json({ error: 'Happy hour not found' });

    const newAttractionId = attraction_id != null ? Number(attraction_id) : current.attraction_id;
    const newStart = start_time != null ? start_time : current.start_time;
    const newEnd = end_time != null ? end_time : current.end_time;

    // Validate overlap if any of these changed
    if (attraction_id != null || start_time != null || end_time != null) {
      const ov = await pool.query(overlapExistsQuery(true), [newAttractionId, newStart, newEnd, id]);
      if (ov.rows[0]) {
        return res.status(409).json({ error: 'Overlapping happy hour exists for this attraction/time range' });
      }
    }

    const fields = [];
    const params = [];
    let i = 1;

    if (attraction_id != null) {
      fields.push(`attraction_id = $${i++}`);
      params.push(newAttractionId);
    }
    if (start_time != null) {
      fields.push(`start_time = $${i++}::time`);
      params.push(newStart);
    }
    if (end_time != null) {
      fields.push(`end_time = $${i++}::time`);
      params.push(newEnd);
    }
    if (discount_percent != null) {
      fields.push(`discount_percent = $${i++}`);
      params.push(Number(discount_percent));
    }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    const { rows } = await pool.query(
      `UPDATE happy_hours SET ${fields.join(', ')}, updated_at = NOW()
       WHERE hh_id = $${i}
       RETURNING hh_id, attraction_id, start_time, end_time, discount_percent, created_at, updated_at`,
      [...params, id]
    );

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.deleteHappyHour = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rowCount } = await pool.query(`DELETE FROM happy_hours WHERE hh_id = $1`, [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Happy hour not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};