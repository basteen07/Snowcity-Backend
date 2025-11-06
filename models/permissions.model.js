const { pool } = require('../config/db');

async function createPermission({ permission_key, description = null }) {
  const { rows } = await pool.query(
    `INSERT INTO permissions (permission_key, description)
     VALUES ($1, $2)
     RETURNING permission_id, permission_key, description, created_at, updated_at`,
    [permission_key, description]
  );
  return rows[0];
}

async function getPermissionById(permission_id) {
  const { rows } = await pool.query(
    `SELECT permission_id, permission_key, description, created_at, updated_at
     FROM permissions WHERE permission_id = $1`,
    [permission_id]
  );
  return rows[0] || null;
}

async function listPermissions({ q = '' } = {}) {
  const params = [];
  let where = '';
  if (q) {
    where = `WHERE permission_key ILIKE $1 OR description ILIKE $1`;
    params.push(`%${q}%`);
  }
  const { rows } = await pool.query(
    `SELECT permission_id, permission_key, description, created_at, updated_at
     FROM permissions
     ${where}
     ORDER BY LOWER(permission_key)`,
    params
  );
  return rows;
}

async function updatePermission(permission_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getPermissionById(permission_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    sets.push(`${k} = $${idx + 1}`);
    params.push(v);
  });
  params.push(permission_id);

  const { rows } = await pool.query(
    `UPDATE permissions SET ${sets.join(', ')}, updated_at = NOW()
     WHERE permission_id = $${params.length}
     RETURNING permission_id, permission_key, description, created_at, updated_at`,
    params
  );
  return rows[0] || null;
}

async function deletePermission(permission_id) {
  const { rowCount } = await pool.query(`DELETE FROM permissions WHERE permission_id = $1`, [permission_id]);
  return rowCount > 0;
}

module.exports = {
  createPermission,
  getPermissionById,
  listPermissions,
  updatePermission,
  deletePermission,
};