const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../../config/db');
const logger = require('../../config/logger');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

const isUniqueViolation = (err) => err && err.code === '23505';

function getPagination(query) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function mapUserRow(row) {
  return {
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    roles: row.roles || [],
  };
}

exports.listUsers = async (req, res, next) => {
  try {
    const { search = '', role = '', from, to } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = [];
    const params = [];
    let i = 1;

    if (search) {
      where.push(`(u.name ILIKE $${i} OR u.email ILIKE $${i} OR u.phone ILIKE $${i})`);
      params.push(`%${search}%`);
      i += 1;
    }
    if (role) {
      where.push(`EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.role_id = ur.role_id
        WHERE ur.user_id = u.user_id AND LOWER(r.role_name) = $${i}
      )`);
      params.push(String(role).toLowerCase());
      i += 1;
    }
    if (from) {
      where.push(`u.created_at >= $${i}::timestamptz`);
      params.push(from);
      i += 1;
    }
    if (to) {
      where.push(`u.created_at < $${i}::timestamptz`);
      params.push(to);
      i += 1;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const dataSql = `
      SELECT
        u.user_id, u.name, u.email, u.phone, u.last_login_at, u.created_at, u.updated_at,
        COALESCE(ARRAY_AGG(DISTINCT r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.user_id
      LEFT JOIN roles r ON r.role_id = ur.role_id
      ${whereSql}
      GROUP BY u.user_id
      ORDER BY u.created_at DESC
      LIMIT $${i} OFFSET $${i + 1};
    `;
    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM users u
      ${whereSql};
    `;

    const dataParams = params.concat([limit, offset]);

    const [rowsRes, countRes] = await Promise.all([pool.query(dataSql, dataParams), pool.query(countSql, params)]);
    const total = countRes.rows[0]?.count || 0;

    res.json({
      data: rowsRes.rows.map(mapUserRow),
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const sql = `
      SELECT
        u.user_id, u.name, u.email, u.phone, u.last_login_at, u.created_at, u.updated_at,
        COALESCE(ARRAY_AGG(DISTINCT r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.user_id
      LEFT JOIN roles r ON r.role_id = ur.role_id
      WHERE u.user_id = $1
      GROUP BY u.user_id;
    `;
    const { rows } = await pool.query(sql, [id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(mapUserRow(user));
  } catch (err) {
    next(err);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, phone, password, roles = [] } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }

    const password_hash = await bcrypt.hash(String(password), SALT_ROUNDS);

    const result = await withTransaction(async (client) => {
      const insertSql = `
        INSERT INTO users (name, email, phone, password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING user_id, name, email, phone, created_at, updated_at;
      `;
      const { rows } = await client.query(insertSql, [name.trim(), email.trim(), phone || null, password_hash]);
      const user = rows[0];

      // Assign roles (create roles if needed)
      if (Array.isArray(roles) && roles.length) {
        const normalized = roles.map((r) => String(r).toLowerCase());
        // Ensure all role_ids exist
        const { rows: roleRows } = await client.query(
          `SELECT role_id, LOWER(role_name) AS role_name FROM roles WHERE LOWER(role_name) = ANY($1::text[])`,
          [normalized]
        );
        const existingMap = new Map(roleRows.map((r) => [r.role_name, r.role_id]));
        // Create missing
        for (const roleName of normalized) {
          if (!existingMap.has(roleName)) {
            const ins = await client.query(
              `INSERT INTO roles (role_name, description) VALUES ($1, $2) RETURNING role_id`,
              [roleName, `${roleName} role`]
            );
            existingMap.set(roleName, ins.rows[0].role_id);
          }
        }
        const roleIds = [...existingMap.values()];
        for (const rid of roleIds) {
          await client.query(
            `INSERT INTO user_roles (user_id, role_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, role_id) DO NOTHING`,
            [user.user_id, rid]
          );
        }
        user.roles = normalized;
      } else {
        user.roles = [];
      }

      return user;
    });

    res.status(201).json(result);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'Email or phone already exists' });
    }
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, email, phone, password, roles } = req.body;

    const result = await withTransaction(async (client) => {
      // Update core fields
      const fields = [];
      const params = [];
      let i = 1;

      if (name != null) {
        fields.push(`name = $${i++}`);
        params.push(String(name).trim());
      }
      if (email != null) {
        fields.push(`email = $${i++}`);
        params.push(String(email).trim());
      }
      if (phone != null) {
        fields.push(`phone = $${i++}`);
        params.push(phone || null);
      }
      if (password != null && String(password).length > 0) {
        const hash = await bcrypt.hash(String(password), SALT_ROUNDS);
        fields.push(`password_hash = $${i++}`);
        params.push(hash);
      }

      if (fields.length) {
        const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE user_id = $${i} RETURNING *;`;
        params.push(id);
        const { rows } = await client.query(sql, params);
        if (!rows[0]) throw Object.assign(new Error('User not found'), { status: 404 });
      } else {
        // Ensure user exists
        const chk = await client.query(`SELECT 1 FROM users WHERE user_id = $1`, [id]);
        if (!chk.rows[0]) throw Object.assign(new Error('User not found'), { status: 404 });
      }

      // Sync roles if provided
      if (Array.isArray(roles)) {
        const normalized = roles.map((r) => String(r).toLowerCase());

        // Fetch existing role ids
        const { rows: roleRows } = await client.query(
          `SELECT role_id, LOWER(role_name) AS role_name FROM roles WHERE LOWER(role_name) = ANY($1::text[])`,
          [normalized]
        );
        const existingMap = new Map(roleRows.map((r) => [r.role_name, r.role_id]));
        // Create missing roles
        for (const roleName of normalized) {
          if (!existingMap.has(roleName)) {
            const ins = await client.query(
              `INSERT INTO roles (role_name, description) VALUES ($1, $2) RETURNING role_id`,
              [roleName, `${roleName} role`]
            );
            existingMap.set(roleName, ins.rows[0].role_id);
          }
        }
        const desiredIds = [...existingMap.values()];

        // Insert missing user_roles
        for (const rid of desiredIds) {
          await client.query(
            `INSERT INTO user_roles (user_id, role_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, role_id) DO NOTHING`,
            [id, rid]
          );
        }

        // Remove extra roles
        if (desiredIds.length) {
          await client.query(
            `DELETE FROM user_roles
             WHERE user_id = $1
               AND role_id NOT IN (${desiredIds.map((_, idx) => `$${idx + 2}`).join(', ')})`,
            [id, ...desiredIds]
          );
        } else {
          await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [id]);
        }
      }

      const out = await client.query(
        `SELECT
           u.user_id, u.name, u.email, u.phone, u.last_login_at, u.created_at, u.updated_at,
           COALESCE(ARRAY_AGG(DISTINCT r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.user_id
         LEFT JOIN roles r ON r.role_id = ur.role_id
         WHERE u.user_id = $1
         GROUP BY u.user_id`,
        [id]
      );

      return out.rows[0];
    });

    res.json(mapUserRow(result));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'Email or phone already exists' });
    }
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rowCount } = await pool.query(`DELETE FROM users WHERE user_id = $1`, [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};