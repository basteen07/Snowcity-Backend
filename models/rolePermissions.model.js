const { pool } = require('../config/db');

async function addPermissionToRole(role_id, permission_id) {
  const { rows } = await pool.query(
    `INSERT INTO role_permissions (role_id, permission_id)
     VALUES ($1, $2)
     ON CONFLICT (role_id, permission_id) DO NOTHING
     RETURNING id, role_id, permission_id, created_at, updated_at`,
    [role_id, permission_id]
  );
  return rows[0] || { role_id, permission_id, created_at: null, updated_at: null };
}

async function removePermissionFromRole(role_id, permission_id) {
  const { rowCount } = await pool.query(
    `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
    [role_id, permission_id]
  );
  return rowCount > 0;
}

async function listPermissionsForRole(role_id) {
  const { rows } = await pool.query(
    `SELECT p.permission_id, p.permission_key, p.description
     FROM role_permissions rp
     JOIN permissions p ON p.permission_id = rp.permission_id
     WHERE rp.role_id = $1
     ORDER BY LOWER(p.permission_key)`,
    [role_id]
  );
  return rows;
}

module.exports = {
  addPermissionToRole,
  removePermissionFromRole,
  listPermissionsForRole,
};