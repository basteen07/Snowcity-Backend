const { pool } = require('../../config/db');

const isUniqueViolation = (err) => err && err.code === '23505';

exports.listPermissions = async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
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
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.getPermissionById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT permission_id, permission_key, description, created_at, updated_at
       FROM permissions WHERE permission_id = $1`,
      [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Permission not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.createPermission = async (req, res, next) => {
  try {
    const { permission_key, description = null } = req.body;
    if (!permission_key) return res.status(400).json({ error: 'permission_key is required' });

    const { rows } = await pool.query(
      `INSERT INTO permissions (permission_key, description)
       VALUES ($1, $2)
       RETURNING permission_id, permission_key, description, created_at, updated_at`,
      [permission_key, description]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'Permission key already exists' });
    }
    next(err);
  }
};

exports.updatePermission = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { permission_key, description } = req.body;

    const fields = [];
    const params = [];
    let i = 1;

    if (permission_key != null) {
      fields.push(`permission_key = $${i++}`);
      params.push(permission_key);
    }
    if (description !== undefined) {
      fields.push(`description = $${i++}`);
      params.push(description);
    }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    const sql = `UPDATE permissions SET ${fields.join(', ')}, updated_at = NOW()
                 WHERE permission_id = $${i}
                 RETURNING permission_id, permission_key, description, created_at, updated_at`;
    params.push(id);

    const { rows } = await pool.query(sql, params);
    if (!rows[0]) return res.status(404).json({ error: 'Permission not found' });

    res.json(rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'Permission key already exists' });
    }
    next(err);
  }
};

exports.deletePermission = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rowCount } = await pool.query(`DELETE FROM permissions WHERE permission_id = $1`, [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Permission not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};