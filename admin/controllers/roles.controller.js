const { pool, withTransaction } = require('../../config/db');

const isUniqueViolation = (err) => err && err.code === '23505';

exports.listRoles = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        r.role_id, r.role_name, r.description, r.created_at, r.updated_at,
        COALESCE(COUNT(DISTINCT ur.user_id), 0)::int AS user_count,
        COALESCE(COUNT(DISTINCT rp.permission_id), 0)::int AS permission_count
      FROM roles r
      LEFT JOIN user_roles ur ON ur.role_id = r.role_id
      LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
      GROUP BY r.role_id
      ORDER BY LOWER(r.role_name) ASC;
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.getRoleById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const roleRes = await pool.query(
      `
      SELECT r.role_id, r.role_name, r.description, r.created_at, r.updated_at
      FROM roles r
      WHERE r.role_id = $1
      `,
      [id]
    );
    const role = roleRes.rows[0];
    if (!role) return res.status(404).json({ error: 'Role not found' });

    const permsRes = await pool.query(
      `
      SELECT p.permission_id, p.permission_key, p.description
      FROM role_permissions rp
      JOIN permissions p ON p.permission_id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY LOWER(p.permission_key)
      `,
      [id]
    );

    const usersRes = await pool.query(
      `
      SELECT u.user_id, u.name, u.email
      FROM user_roles ur
      JOIN users u ON u.user_id = ur.user_id
      WHERE ur.role_id = $1
      ORDER BY u.name ASC
      `,
      [id]
    );

    res.json({
      ...role,
      permissions: permsRes.rows,
      users: usersRes.rows,
    });
  } catch (err) {
    next(err);
  }
};

exports.createRole = async (req, res, next) => {
  try {
    const { role_name, description = null } = req.body;
    if (!role_name) return res.status(400).json({ error: 'role_name is required' });

    const { rows } = await pool.query(
      `INSERT INTO roles (role_name, description)
       VALUES ($1, $2)
       RETURNING role_id, role_name, description, created_at, updated_at`,
      [role_name, description]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'Role name already exists' });
    }
    next(err);
  }
};

exports.updateRole = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { role_name, description } = req.body;

    const fields = [];
    const params = [];
    let i = 1;

    if (role_name != null) {
      fields.push(`role_name = $${i++}`);
      params.push(role_name);
    }
    if (description !== undefined) {
      fields.push(`description = $${i++}`);
      params.push(description);
    }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    const sql = `UPDATE roles SET ${fields.join(', ')}, updated_at = NOW()
                 WHERE role_id = $${i}
                 RETURNING role_id, role_name, description, created_at, updated_at`;
    params.push(id);

    const { rows } = await pool.query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'Role not found' });

    res.json(rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'Role name already exists' });
    }
    next(err);
  }
};

exports.deleteRole = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // Optional safety: prevent deleting the 'admin' role
    const chk = await pool.query(`SELECT LOWER(role_name) AS name FROM roles WHERE role_id = $1`, [id]);
    if (!chk.rows[0]) return res.status(404).json({ error: 'Role not found' });
    if (chk.rows[0].name === 'admin') {
      return res.status(400).json({ error: 'Cannot delete the admin role' });
    }

    const { rowCount } = await pool.query(`DELETE FROM roles WHERE role_id = $1`, [id]);
    res.json({ deleted: rowCount > 0 });
  } catch (err) {
    next(err);
  }
};

exports.getRolePermissions = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `
      SELECT p.permission_id, p.permission_key, p.description
      FROM role_permissions rp
      JOIN permissions p ON p.permission_id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY LOWER(p.permission_key)
      `,
      [id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.setRolePermissions = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { permissions = [] } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions should be an array of permission keys' });
    }
    const keys = permissions.map((p) => String(p).toLowerCase());

    const result = await withTransaction(async (client) => {
      // Ensure role exists
      const roleRes = await client.query(`SELECT role_id FROM roles WHERE role_id = $1`, [id]);
      if (!roleRes.rows[0]) throw Object.assign(new Error('Role not found'), { status: 404 });

      // Fetch existing permission ids by key
      const { rows: existingPerms } = await client.query(
        `SELECT permission_id, LOWER(permission_key) AS permission_key
         FROM permissions WHERE LOWER(permission_key) = ANY($1::text[])`,
        [keys]
      );
      const keyToId = new Map(existingPerms.map((r) => [r.permission_key, r.permission_id]));

      // Insert missing permissions
      for (const key of keys) {
        if (!keyToId.has(key)) {
          const ins = await client.query(
            `INSERT INTO permissions (permission_key, description)
             VALUES ($1, $2) RETURNING permission_id`,
            [key, `${key} permission`]
          );
          keyToId.set(key, ins.rows[0].permission_id);
        }
      }

      const desiredIds = keys.map((k) => keyToId.get(k)).filter(Boolean);

      // Insert missing role_permissions
      for (const pid of desiredIds) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT (role_id, permission_id) DO NOTHING`,
          [id, pid]
        );
      }

      // Remove extras not desired
      if (desiredIds.length) {
        await client.query(
          `DELETE FROM role_permissions
           WHERE role_id = $1
             AND permission_id NOT IN (${desiredIds.map((_, idx) => `$${idx + 2}`).join(', ')})`,
          [id, ...desiredIds]
        );
      } else {
        await client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [id]);
      }

      // Return updated permission list
      const { rows } = await client.query(
        `SELECT p.permission_id, p.permission_key, p.description
         FROM role_permissions rp
         JOIN permissions p ON p.permission_id = rp.permission_id
         WHERE rp.role_id = $1
         ORDER BY LOWER(p.permission_key)`,
        [id]
      );
      return rows;
    });

    res.json({ role_id: id, permissions: result });
  } catch (err) {
    next(err);
  }
};