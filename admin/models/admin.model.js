const { pool, withTransaction } = require('../../config/db');
const logger = require('../../config/logger');

const ADMIN_ROLES = ['admin', 'subadmin'];

function sanitizeGranularity(granularity) {
  const g = String(granularity || 'day').toLowerCase();
  return ['day', 'week', 'month'].includes(g) ? g : 'day';
}

/**
 * Dashboard summary KPIs
 * - total_bookings (non-cancelled)
 * - total_revenue (Completed payments)
 * - today_bookings
 * - pending_payments
 * - unique_users
 */
async function getDashboardSummary({ from = null, to = null, attraction_id = null } = {}) {
  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
                       AND b.created_at < COALESCE($2::timestamptz, NOW())) AS total_bookings,
      COALESCE(SUM(CASE WHEN b.payment_status = 'Completed' THEN b.final_amount ELSE 0 END)
               FILTER (WHERE b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
                       AND b.created_at < COALESCE($2::timestamptz, NOW())), 0) AS total_revenue,
      COUNT(*) FILTER (WHERE b.created_at::date = CURRENT_DATE) AS today_bookings,
      COUNT(*) FILTER (WHERE b.payment_status = 'Pending'
                       AND b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
                       AND b.created_at < COALESCE($2::timestamptz, NOW())) AS pending_payments,
      COUNT(DISTINCT b.user_id) FILTER (WHERE b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
                       AND b.created_at < COALESCE($2::timestamptz, NOW())) AS unique_users
    FROM bookings b
    WHERE b.booking_status <> 'Cancelled'
      AND ($3::bigint IS NULL OR b.attraction_id = $3::bigint);
  `;
  const { rows } = await pool.query(sql, [from, to, attraction_id]);
  return rows[0];
}

/**
 * Top attractions by bookings and revenue within range
 */
async function getTopAttractions({ from = null, to = null, limit = 10, attraction_id = null } = {}) {
  const sql = `
    SELECT
      a.attraction_id,
      a.title,
      COUNT(*) AS bookings,
      COALESCE(SUM(CASE WHEN b.payment_status = 'Completed' THEN b.final_amount ELSE 0 END), 0) AS revenue
    FROM bookings b
    JOIN attractions a ON a.attraction_id = b.attraction_id
    WHERE b.booking_status <> 'Cancelled'
      AND b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
      AND b.created_at <  COALESCE($2::timestamptz, NOW())
      AND ($3::bigint IS NULL OR b.attraction_id = $3::bigint)
    GROUP BY a.attraction_id, a.title
    ORDER BY bookings DESC, revenue DESC
    LIMIT $4;
  `;
  const { rows } = await pool.query(sql, [from, to, attraction_id, limit]);
  return rows;
}

/**
 * Time-series trend of bookings and revenue
 * granularity: 'day' | 'week' | 'month'
 */
async function getSalesTrend({ from = null, to = null, granularity = 'day', attraction_id = null } = {}) {
  const g = sanitizeGranularity(granularity);
  const sql = `
    SELECT
      date_trunc('${g}', b.created_at) AS bucket,
      COUNT(*) AS bookings,
      COALESCE(SUM(CASE WHEN b.payment_status = 'Completed' THEN b.final_amount ELSE 0 END), 0) AS revenue
    FROM bookings b
    WHERE b.booking_status <> 'Cancelled'
      AND b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
      AND b.created_at <  COALESCE($2::timestamptz, NOW())
      AND ($3::bigint IS NULL OR b.attraction_id = $3::bigint)
    GROUP BY bucket
    ORDER BY bucket ASC;
  `;
  const { rows } = await pool.query(sql, [from, to, attraction_id]);
  return rows;
}

/**
 * Latest bookings for admin dashboard table
 */
async function getRecentBookings({ limit = 20, offset = 0, attraction_id = null } = {}) {
  const sql = `
    SELECT
      b.booking_id, b.booking_ref, b.user_id, b.attraction_id, b.slot_id,
      b.final_amount, b.payment_status, b.payment_mode, b.booking_status,
      b.created_at,
      u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
      a.title AS attraction_title
    FROM bookings b
    LEFT JOIN users u ON u.user_id = b.user_id
    LEFT JOIN attractions a ON a.attraction_id = b.attraction_id
    WHERE ($1::bigint IS NULL OR b.attraction_id = $1::bigint)
    ORDER BY b.created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const { rows } = await pool.query(sql, [attraction_id, limit, offset]);
  return rows;
}

/**
 * Count bookings by booking_status for a quick status breakdown
 */
async function getBookingCountsByStatus({ from = null, to = null, attraction_id = null } = {}) {
  const sql = `
    SELECT b.booking_status, COUNT(*)::int AS count
    FROM bookings b
    WHERE b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
      AND b.created_at <  COALESCE($2::timestamptz, NOW())
      AND ($3::bigint IS NULL OR b.attraction_id = $3::bigint)
    GROUP BY b.booking_status
    ORDER BY b.booking_status;
  `;
  const { rows } = await pool.query(sql, [from, to, attraction_id]);
  return rows;
}

/**
 * List admin/subadmin users with roles
 */
async function listAdmins({ search = '', role = null, limit = 20, offset = 0 } = {}) {
  const params = [];
  let idx = 1;

  let where = `LOWER(r.role_name) = ANY($${idx}::text[])`;
  params.push(ADMIN_ROLES.map((r) => r.toLowerCase()));
  idx += 1;

  if (role) {
    where += ` AND LOWER(r.role_name) = $${idx}`;
    params.push(String(role).toLowerCase());
    idx += 1;
  }

  if (search) {
    where += ` AND (u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.phone ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx += 1;
  }

  const sql = `
    SELECT
      u.user_id, u.name, u.email, u.phone, u.created_at,
      ARRAY_AGG(DISTINCT r.role_name) AS roles
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.user_id
    JOIN roles r ON r.role_id = ur.role_id
    WHERE ${where}
    GROUP BY u.user_id
    ORDER BY u.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1};
  `;
  params.push(limit, offset);

  const { rows } = await pool.query(sql, params);
  return rows;
}

/**
 * Ensure a role exists, return role_id
 */
async function ensureRole(roleName) {
  const name = String(roleName).toLowerCase();
  const selectSql = `SELECT role_id FROM roles WHERE LOWER(role_name) = $1 LIMIT 1`;
  const found = await pool.query(selectSql, [name]);
  if (found.rows[0]) return found.rows[0].role_id;

  const insertSql = `INSERT INTO roles (role_name, description) VALUES ($1, $2) RETURNING role_id`;
  const { rows } = await pool.query(insertSql, [name, `${name} role`]);
  return rows[0].role_id;
}

/**
 * Assign role to user (idempotent)
 */
async function assignRoleByName(userId, roleName) {
  return withTransaction(async (client) => {
    const roleId = await (async () => {
      const name = String(roleName).toLowerCase();
      const sel = await client.query(`SELECT role_id FROM roles WHERE LOWER(role_name) = $1`, [name]);
      if (sel.rows[0]) return sel.rows[0].role_id;
      const ins = await client.query(
        `INSERT INTO roles (role_name, description) VALUES ($1, $2) RETURNING role_id`,
        [name, `${name} role`]
      );
      return ins.rows[0].role_id;
    })();

    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, roleId]
    );
    return { userId, roleId, assigned: true };
  });
}

/**
 * Revoke role from user
 */
async function revokeRoleByName(userId, roleName) {
  const name = String(roleName).toLowerCase();
  const sql = `
    DELETE FROM user_roles
    WHERE user_id = $1 AND role_id IN (
      SELECT role_id FROM roles WHERE LOWER(role_name) = $2
    )
    RETURNING user_id;
  `;
  const { rowCount } = await pool.query(sql, [userId, name]);
  return { userId, revoked: rowCount > 0 };
}

/**
 * Get all permissions for a user (via roles)
 */
async function getUserPermissions(userId) {
  const sql = `
    SELECT DISTINCT LOWER(p.permission_key) AS permission_key
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.permission_id = rp.permission_id
    WHERE ur.user_id = $1
    ORDER BY permission_key;
  `;
  const { rows } = await pool.query(sql, [userId]);
  return rows.map((r) => r.permission_key);
}

/**
 * Admin overview: combine several metrics
 */
async function getAdminOverview({ from = null, to = null, attraction_id = null } = {}) {
  const [summary, statusBreakdown, topAttractions, trend] = await Promise.all([
    getDashboardSummary({ from, to, attraction_id }),
    getBookingCountsByStatus({ from, to, attraction_id }),
    getTopAttractions({ from, to, attraction_id, limit: 5 }),
    getSalesTrend({ from, to, attraction_id, granularity: 'day' }),
  ]);

  return {
    summary,
    statusBreakdown,
    topAttractions,
    trend,
  };
}

module.exports = {
  getDashboardSummary,
  getTopAttractions,
  getSalesTrend,
  getRecentBookings,
  getBookingCountsByStatus,
  listAdmins,
  ensureRole,
  assignRoleByName,
  revokeRoleByName,
  getUserPermissions,
  getAdminOverview,
};