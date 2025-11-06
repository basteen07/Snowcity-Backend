const { pool } = require('../config/db');

async function createRole({ role_name, description = null }) {
  const { rows } = await pool.query(
    `INSERT INTO roles (role_name, description)
     VALUES ($1, $2)
     RETURNING role_id, role_name, description, created_at, updated_at`,
    [role_name, description]
  );
  return rows[0];
}

async function getRoleById(role_id) {
  const { rows } = await pool.query(
    `SELECT role_id, role_name, description, created_at, updated_at
     FROM roles WHERE role_id = $1`,
    [role_id]
  );
  return rows[0] || null;
}

async function listRoles() {
  const { rows } = await pool.query(
    `SELECT role_id, role_name, description, created_at, updated_at
     FROM roles ORDER BY LOWER(role_name)`
  );
  return rows;
}

async function updateRole(role_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getRoleById(role_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    sets.push(`${k} = $${idx + 1}`);
    params.push(v);
  });
  params.push(role_id);

  const { rows } = await pool.query(
    `UPDATE roles SET ${sets.join(', ')}, updated_at = NOW()
     WHERE role_id = $${params.length}
     RETURNING role_id, role_name, description, created_at, updated_at`,
    params
  );
  return rows[0] || null;
}

async function deleteRole(role_id) {
  const { rowCount } = await pool.query(`DELETE FROM roles WHERE role_id = $1`, [role_id]);
  return rowCount > 0;
}

module.exports = {
  createRole,
  getRoleById,
  listRoles,
  updateRole,
  deleteRole,
};