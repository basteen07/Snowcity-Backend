// admin/controllers/admins.controller.js
const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../../config/db');
const adminModel = require('../models/admin.model');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

exports.listAdmins = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const role = req.query.role ? String(req.query.role).toLowerCase() : null;
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const rows = await adminModel.listAdmins({ search, role, limit, offset });
    res.json(rows);
  } catch (err) { next(err); }
};

exports.createAdmin = async (req, res, next) => {
  try {
    const { name, email, password, phone = null, roles = ['subadmin'] } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password are required' });

    const hash = await bcrypt.hash(String(password), SALT_ROUNDS);

    const user = await withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO users (name, email, phone, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING user_id, name, email, phone, created_at, updated_at`,
        [name.trim(), email.trim(), phone || null, hash]
      );
      const u = ins.rows[0];

      // Ensure roles exist and assign
      const normalized = (roles || []).map((r) => String(r).toLowerCase());
      if (normalized.length) {
        const existing = await client.query(
          `SELECT role_id, LOWER(role_name) AS role_name FROM roles WHERE LOWER(role_name) = ANY($1::text[])`,
          [normalized]
        );
        const map = new Map(existing.rows.map((r) => [r.role_name, r.role_id]));
        for (const r of normalized) {
          if (!map.has(r)) {
            const insRole = await client.query(
              `INSERT INTO roles (role_name, description) VALUES ($1, $2) RETURNING role_id`,
              [r, `${r} role`]
            );
            map.set(r, insRole.rows[0].role_id);
          }
        }
        const roleIds = [...map.values()];
        for (const rid of roleIds) {
          await client.query(
            `INSERT INTO user_roles (user_id, role_id)
             VALUES ($1, $2) ON CONFLICT (user_id, role_id) DO NOTHING`,
            [u.user_id, rid]
          );
        }
      }
      return u;
    });

    res.status(201).json(user);
  } catch (err) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Email or phone already exists' });
    next(err);
  }
};

function hasFullAdminAccess(roles = []) {
  const normalized = roles.map((r) => String(r).toLowerCase());
  return normalized.includes('admin') || normalized.includes('root') || normalized.includes('superadmin');
}

async function loadAccessMap(userId) {
  const { rows } = await pool.query(
    `SELECT resource_type, resource_id FROM admin_access WHERE user_id = $1 ORDER BY resource_type, resource_id`,
    [userId]
  );
  return rows.reduce((acc, r) => {
    if (!acc[r.resource_type]) acc[r.resource_type] = [];
    acc[r.resource_type].push(Number(r.resource_id));
    return acc;
  }, {});
}

exports.getMyAccess = async (req, res, next) => {
  try {
    const userId = Number(req.user?.id);
    if (!Number.isInteger(userId)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (hasFullAdminAccess(req.user?.roles || [])) {
      return res.json({ user_id: userId, access: {}, all_access: true });
    }
    const access = await loadAccessMap(userId);
    res.json({ user_id: userId, access, all_access: false });
  } catch (err) {
    next(err);
  }
};

exports.getAccess = async (req, res, next) => {
  try {
    const param = String(req.params.id || '').trim();
    const requesterId = Number(req.user?.id);
    const userId = param.toLowerCase() === 'me' ? requesterId : Number(param);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    if (userId === requesterId && hasFullAdminAccess(req.user?.roles || [])) {
      return res.json({ user_id: userId, access: {}, all_access: true });
    }

    const access = await loadAccessMap(userId);
    res.json({ user_id: userId, access, all_access: false });
  } catch (err) { next(err); }
};

exports.setAccess = async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const payload = req.body?.access || req.body || {};
    const allowedTypes = ['attraction','combo','banner','page','blog','gallery'];

    await withTransaction(async (client) => {
      const types = allowedTypes.filter((t) => Array.isArray(payload[t]));
      if (types.length) {
        await client.query(
          `DELETE FROM admin_access WHERE user_id = $1 AND resource_type = ANY($2::text[])`,
          [userId, types]
        );
      }
      for (const t of types) {
        const ids = [...new Set(payload[t].map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))];
        for (const id of ids) {
          await client.query(
            `INSERT INTO admin_access (user_id, resource_type, resource_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, resource_type, resource_id) DO NOTHING`,
            [userId, t, id]
          );
        }
      }
    });

    res.json({ user_id: userId, access: payload });
  } catch (err) { next(err); }
};