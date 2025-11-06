const { pool } = require('../config/db');

async function addRoleToUser(user_id, role_id) {
  const { rows } = await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING
     RETURNING id, user_id, role_id, created_at, updated_at`,
    [user_id, role_id]
  );
  return rows[0] || { user_id, role_id, created_at: null, updated_at: null };
}

async function removeRoleFromUser(user_id, role_id) {
  const { rowCount } = await pool.query(
    `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`,
    [user_id, role_id]
  );
  return rowCount > 0;
}

async function listRolesForUser(user_id) {
  const { rows } = await pool.query(
    `SELECT r.role_id, r.role_name, r.description
     FROM user_roles ur
     JOIN roles r ON r.role_id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY LOWER(r.role_name)`,
    [user_id]
  );
  return rows;
}

async function listUsersForRole(role_id) {
  const { rows } = await pool.query(
    `SELECT u.user_id, u.name, u.email, u.phone
     FROM user_roles ur
     JOIN users u ON u.user_id = ur.user_id
     WHERE ur.role_id = $1
     ORDER BY u.name ASC`,
    [role_id]
  );
  return rows;
}

module.exports = {
  addRoleToUser,
  removeRoleFromUser,
  listRolesForUser,
  listUsersForRole,
};