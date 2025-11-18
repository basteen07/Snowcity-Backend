// admin/models/admin.model.js
const { pool } = require('../../config/db');

const ADMIN_ROLES = ['root', 'admin', 'subadmin', 'superadmin'];

function sanitizeGranularity(granularity) {
  const g = String(granularity || 'day').toLowerCase();
  return ['day', 'week', 'month'].includes(g) ? g : 'day';
}

// Dashboard summary KPIs (includes total_people)
async function getDashboardSummary({ from = null, to = null, attraction_id = null } = {}) {
  const sql = `
    SELECT
      COUNT(*) FILTER (
        WHERE b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
          AND b.created_at <  COALESCE($2::timestamptz, NOW())
      ) AS total_bookings,

      COALESCE(SUM(CASE WHEN b.payment_status = 'Completed' THEN b.final_amount ELSE 0 END)
        FILTER (
          WHERE b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
            AND b.created_at <  COALESCE($2::timestamptz, NOW())
        ), 0) AS total_revenue,

      COALESCE(SUM(b.quantity)
        FILTER (
          WHERE b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
            AND b.created_at <  COALESCE($2::timestamptz, NOW())
        ), 0) AS total_people,

      COUNT(*) FILTER (WHERE b.created_at::date = CURRENT_DATE) AS today_bookings,

      COUNT(*) FILTER (
        WHERE b.payment_status = 'Pending'
          AND b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
          AND b.created_at <  COALESCE($2::timestamptz, NOW())
      ) AS pending_payments,

      COUNT(DISTINCT b.user_id) FILTER (
        WHERE b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
          AND b.created_at <  COALESCE($2::timestamptz, NOW())
      ) AS unique_users

    FROM bookings b
    WHERE b.booking_status <> 'Cancelled'
      AND ($3::bigint IS NULL OR b.attraction_id = $3::bigint);
  `;
  const { rows } = await pool.query(sql, [from, to, attraction_id]);
  return rows[0];
}

// Top attractions (bookings, people, revenue) within range
async function getTopAttractions({ from = null, to = null, limit = 10, attraction_id = null } = {}) {
  const sql = `
    SELECT
      a.attraction_id,
      a.title,
      COUNT(*) AS bookings,
      COALESCE(SUM(b.quantity), 0) AS people,
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

// Combo vs offer contribution stats
async function getComboOfferStats({ from = null, to = null, attraction_id = null } = {}) {
  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE b.item_type = 'Combo')::int AS combo_bookings,
      COALESCE(SUM(CASE WHEN b.item_type = 'Combo' AND b.payment_status = 'Completed' THEN b.final_amount ELSE 0 END), 0) AS combo_revenue,
      COUNT(*) FILTER (WHERE b.offer_id IS NOT NULL)::int AS offer_bookings,
      COALESCE(SUM(CASE WHEN b.offer_id IS NOT NULL AND b.payment_status = 'Completed' THEN b.final_amount ELSE 0 END), 0) AS offer_revenue
    FROM bookings b
    WHERE b.booking_status <> 'Cancelled'
      AND b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
      AND b.created_at <  COALESCE($2::timestamptz, NOW())
      AND ($3::bigint IS NULL OR b.attraction_id = $3::bigint);
  `;
  const { rows } = await pool.query(sql, [from, to, attraction_id]);
  const stats = rows[0] || {};
  return {
    combo_bookings: Number(stats.combo_bookings || 0),
    combo_revenue: Number(stats.combo_revenue || 0),
    offer_bookings: Number(stats.offer_bookings || 0),
    offer_revenue: Number(stats.offer_revenue || 0),
  };
}

// Sales trend (bookings, people, revenue) by granularity
async function getSalesTrend({ from = null, to = null, granularity = 'day', attraction_id = null } = {}) {
  const g = sanitizeGranularity(granularity);
  const sql = `
    SELECT
      date_trunc('${g}', b.created_at) AS bucket,
      COUNT(*) AS bookings,
      COALESCE(SUM(b.quantity), 0) AS people,
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

// Latest bookings for admin dashboard
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

// Count bookings by status
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

// List admins/subadmins with roles
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

// Ensure a role exists, return role_id (UPSERT-safe)
async function ensureRole(roleName) {
  const name = String(roleName).toLowerCase();
  const sql = `
    INSERT INTO roles (role_name, description)
    VALUES ($1, $2)
    ON CONFLICT (role_name) DO UPDATE SET description = EXCLUDED.description
    RETURNING role_id;
  `;
  const { rows } = await pool.query(sql, [name, `${name} role`]);
  return rows[0].role_id;
}

// Assign role to user (idempotent)
async function assignRoleByName(userId, roleName) {
  const roleId = await ensureRole(roleName);
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId, roleId]
  );
  return { userId, roleId, assigned: true };
}

// Revoke role from user
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

// Get all permissions for a user (via roles)
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

// Admin overview: combine summary + breakdown + top + trend
async function getAdminOverview({ from = null, to = null, attraction_id = null } = {}) {
  const [summary, statusBreakdown, topAttractions, trend, comboOffers] = await Promise.all([
    getDashboardSummary({ from, to, attraction_id }),
    getBookingCountsByStatus({ from, to, attraction_id }),
    getTopAttractions({ from, to, limit: 5, attraction_id }),
    getSalesTrend({ from, to, granularity: 'day', attraction_id }),
    getComboOfferStats({ from, to, attraction_id }),
  ]);

  return { summary: { ...summary, ...comboOffers }, statusBreakdown, topAttractions, trend };
}

// Attractions-wise breakdown within range
async function getAttractionBreakdown({ from = null, to = null, limit = 50 } = {}) {
  const sql = `
    SELECT
      a.attraction_id,
      a.title,
      COUNT(*) AS bookings,
      COALESCE(SUM(b.quantity), 0) AS people,
      COALESCE(SUM(CASE WHEN b.payment_status = 'Completed' THEN b.final_amount ELSE 0 END), 0) AS revenue
    FROM bookings b
    JOIN attractions a ON a.attraction_id = b.attraction_id
    WHERE b.booking_status <> 'Cancelled'
      AND b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
      AND b.created_at <  COALESCE($2::timestamptz, NOW())
    GROUP BY a.attraction_id, a.title
    ORDER BY bookings DESC, revenue DESC
    LIMIT $3;
  `;
  const { rows } = await pool.query(sql, [from, to, limit]);
  return rows;
}

// Generic split (by payment_status | booking_status | payment_mode)
async function getSplitData({ from = null, to = null, group_by = 'payment_status' } = {}) {
  const allowed = new Set(['payment_status', 'booking_status', 'payment_mode']);
  const col = allowed.has(String(group_by)) ? group_by : 'payment_status';
  const sql = `
    SELECT ${col} AS key,
           COUNT(*)::int AS bookings,
           COALESCE(SUM(b.quantity), 0)::int AS people,
           COALESCE(SUM(CASE WHEN b.payment_status = 'Completed' THEN b.final_amount ELSE 0 END), 0) AS revenue
    FROM bookings b
    WHERE b.created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
      AND b.created_at <  COALESCE($2::timestamptz, NOW())
      AND b.booking_status <> 'Cancelled'
    GROUP BY ${col}
    ORDER BY bookings DESC;
  `;
  const { rows } = await pool.query(sql, [from, to]);
  return rows;
}

module.exports = {
  sanitizeGranularity,
  getDashboardSummary,
  getTopAttractions,
  getSalesTrend,
  getRecentBookings,
  getBookingCountsByStatus,
  getComboOfferStats,
  listAdmins,
  ensureRole,
  assignRoleByName,
  revokeRoleByName,
  getUserPermissions,
  getAdminOverview,
  getAttractionBreakdown,
  getSplitData,
};