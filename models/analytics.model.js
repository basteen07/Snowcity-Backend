const { pool } = require('../config/db');

function mapAnalytics(row) {
  if (!row) return null;
  return {
    analytics_id: row.analytics_id,
    attraction_id: row.attraction_id,
    total_bookings: row.total_bookings,
    total_people: row.total_people,
    total_revenue: row.total_revenue,
    report_date: row.report_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function upsertDaily({ attraction_id, report_date, bookingsInc = 0, peopleInc = 0, revenueInc = 0 }) {
  const { rows } = await pool.query(
    `INSERT INTO analytics (attraction_id, report_date, total_bookings, total_people, total_revenue)
     VALUES ($1, $2::date, $3, $4, $5)
     ON CONFLICT (attraction_id, report_date)
     DO UPDATE SET
       total_bookings = analytics.total_bookings + EXCLUDED.total_bookings,
       total_people   = analytics.total_people + EXCLUDED.total_people,
       total_revenue  = analytics.total_revenue + EXCLUDED.total_revenue,
       updated_at     = NOW()
     RETURNING *`,
    [attraction_id, report_date, bookingsInc, peopleInc, revenueInc]
  );
  return mapAnalytics(rows[0]);
}

async function getAnalytics({ attraction_id = null, from = null, to = null } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (attraction_id) {
    where.push(`a.attraction_id = $${i++}`);
    params.push(Number(attraction_id));
  }
  if (from) {
    where.push(`a.report_date >= $${i++}::date`);
    params.push(from);
  }
  if (to) {
    where.push(`a.report_date <= $${i++}::date`);
    params.push(to);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT a.*
     FROM analytics a
     ${whereSql}
     ORDER BY a.report_date ASC`,
    params
  );
  return rows.map(mapAnalytics);
}

async function getSummary({ from = null, to = null } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (from) {
    where.push(`report_date >= $${i++}::date`);
    params.push(from);
  }
  if (to) {
    where.push(`report_date <= $${i++}::date`);
    params.push(to);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(total_bookings), 0)::int AS total_bookings,
       COALESCE(SUM(total_people), 0)::int AS total_people,
       COALESCE(SUM(total_revenue), 0)::numeric AS total_revenue
     FROM analytics
     ${whereSql}`
  , params);
  return rows[0] || { total_bookings: 0, total_people: 0, total_revenue: 0 };
}

module.exports = {
  upsertDaily,
  getAnalytics,
  getSummary,
};