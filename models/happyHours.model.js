const { pool } = require('../config/db');

function mapHappyHour(row) {
  if (!row) return null;
  return {
    hh_id: row.hh_id,
    attraction_id: row.attraction_id,
    start_time: row.start_time,
    end_time: row.end_time,
    discount_percent: row.discount_percent,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listHappyHours({ attraction_id = null } = {}) {
  const where = [];
  const params = [];
  if (attraction_id) {
    where.push(`attraction_id = $1`);
    params.push(Number(attraction_id));
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM happy_hours
     ${whereSql}
     ORDER BY start_time ASC`,
    params
  );
  return rows.map(mapHappyHour);
}

async function getHappyHourById(hh_id) {
  const { rows } = await pool.query(`SELECT * FROM happy_hours WHERE hh_id = $1`, [hh_id]);
  return mapHappyHour(rows[0]);
}

async function createHappyHour({ attraction_id, start_time, end_time, discount_percent = 0 }) {
  const { rows } = await pool.query(
    `INSERT INTO happy_hours (attraction_id, start_time, end_time, discount_percent)
     VALUES ($1, $2::time, $3::time, $4)
     RETURNING *`,
    [attraction_id, start_time, end_time, discount_percent]
  );
  return mapHappyHour(rows[0]);
}

async function updateHappyHour(hh_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getHappyHourById(hh_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    const cast = ['start_time', 'end_time'].includes(k) ? '::time' : '';
    sets.push(`${k} = $${idx + 1}${cast}`);
    params.push(v);
  });
  params.push(hh_id);

  const { rows } = await pool.query(
    `UPDATE happy_hours SET ${sets.join(', ')}, updated_at = NOW()
     WHERE hh_id = $${params.length}
     RETURNING *`,
    params
  );
  return mapHappyHour(rows[0]);
}

async function deleteHappyHour(hh_id) {
  const { rowCount } = await pool.query(`DELETE FROM happy_hours WHERE hh_id = $1`, [hh_id]);
  return rowCount > 0;
}

async function overlapExists({ attraction_id, start_time, end_time, exclude_id = null }) {
  const params = [attraction_id, start_time, end_time];
  let sql = `
    SELECT 1
    FROM happy_hours
    WHERE attraction_id = $1
      AND start_time < $3::time
      AND end_time > $2::time
  `;
  if (exclude_id) {
    sql += ` AND hh_id <> $4`;
    params.push(exclude_id);
  }
  const { rows } = await pool.query(`${sql} LIMIT 1`, params);
  return !!rows[0];
}

module.exports = {
  listHappyHours,
  getHappyHourById,
  createHappyHour,
  updateHappyHour,
  deleteHappyHour,
  overlapExists,
};