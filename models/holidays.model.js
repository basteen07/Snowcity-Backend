const { pool } = require('../config/db');

function mapHoliday(row) {
  if (!row) return null;
  return {
    holiday_id: row.holiday_id,
    holiday_date: row.holiday_date,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listHolidays({ from = null, to = null, upcoming = false } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (upcoming) {
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
    `SELECT * FROM holidays
     ${whereSql}
     ORDER BY holiday_date ASC`,
    params
  );
  return rows.map(mapHoliday);
}

async function getHolidayById(holiday_id) {
  const { rows } = await pool.query(`SELECT * FROM holidays WHERE holiday_id = $1`, [holiday_id]);
  return mapHoliday(rows[0]);
}

async function createHoliday({ holiday_date, description = null }) {
  const { rows } = await pool.query(
    `INSERT INTO holidays (holiday_date, description)
     VALUES ($1::date, $2)
     RETURNING *`,
    [holiday_date, description]
  );
  return mapHoliday(rows[0]);
}

async function updateHoliday(holiday_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getHolidayById(holiday_id);

  const sets = [];
  const params = [];
  let i = 1;

  entries.forEach(([k, v]) => {
    const cast = k === 'holiday_date' ? '::date' : '';
    sets.push(`${k} = $${i++}${cast}`);
    params.push(v);
  });
  params.push(holiday_id);

  const { rows } = await pool.query(
    `UPDATE holidays SET ${sets.join(', ')}, updated_at = NOW()
     WHERE holiday_id = $${i}
     RETURNING *`,
    params
  );
  return mapHoliday(rows[0]);
}

async function deleteHoliday(holiday_id) {
  const { rowCount } = await pool.query(`DELETE FROM holidays WHERE holiday_id = $1`, [holiday_id]);
  return rowCount > 0;
}

module.exports = {
  listHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};