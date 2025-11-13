// scripts/createRootAdmin.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { pool, withTransaction } = require('../config/db');
const authService = require('../services/authService');

// Full access across all admin sections
const ALL_PERMISSION_KEYS = [
  'users:read', 'users:write',
  'roles:read', 'roles:write',
  'permissions:read', 'permissions:write',
  'settings:read', 'settings:write',
  'notifications:read', 'notifications:write',
  'holidays:read', 'holidays:write',
  'happyhours:read', 'happyhours:write',
  'attractions:read', 'attractions:write',
  'slots:read', 'slots:write',
  'bookings:read', 'bookings:write',
  'addons:read', 'addons:write',
  'combos:read', 'combos:write',
  'coupons:read', 'coupons:write',
  'offers:read', 'offers:write',
  'banners:read', 'banners:write',
  'pages:read', 'pages:write',
  'blogs:read', 'blogs:write',
  'dashboard:read',
  'analytics:read',
];

async function ensureRole(client, roleName) {
  const name = String(roleName).toLowerCase();
  let r = await client.query(`SELECT role_id FROM roles WHERE LOWER(role_name) = $1`, [name]);
  if (r.rows[0]) return r.rows[0].role_id;
  r = await client.query(
    `INSERT INTO roles (role_name, description) VALUES ($1, $2) RETURNING role_id`,
    [name, `${name} role`]
  );
  return r.rows[0].role_id;
}

async function ensurePermission(client, key) {
  const k = String(key).toLowerCase();
  let r = await client.query(`SELECT permission_id FROM permissions WHERE LOWER(permission_key) = $1`, [k]);
  if (r.rows[0]) return r.rows[0].permission_id;
  r = await client.query(
    `INSERT INTO permissions (permission_key, description) VALUES ($1, $2) RETURNING permission_id`,
    [k, `${k} permission`]
  );
  return r.rows[0].permission_id;
}

async function ensureUserHasRole(client, userId, roleId) {
  await client.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId, roleId]
  );
}

async function grantAllAdminPermissions(userId) {
  return withTransaction(async (client) => {
    const adminRoleId = await ensureRole(client, 'admin');
    await ensureUserHasRole(client, userId, adminRoleId);

    const granted = [];
    for (const key of ALL_PERMISSION_KEYS) {
      const pid = await ensurePermission(client, key);
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [adminRoleId, pid]
      );
      granted.push(key);
    }
    return { roleId: adminRoleId, granted };
  });
}

(async () => {
  try {
    const EMAIL = 'Snowcity@gmail.com'; // keep in sync with payload below
    let created = null;

    try {
      const { user, token, expires_at } = await authService.register({
        name: 'Root Admin',
        email: EMAIL,                    // change this
        phone: null,                     // optional
        password: 'Snowcity@123',// change this
        isAdmin: true,                   // ensures admin role assignment
      });
      created = { user, token, expires_at };
    } catch (e) {
      // If the user already exists, fetch and continue granting permissions
      const { rows } = await pool.query(
        `SELECT user_id, name, email FROM users WHERE email = $1`,
        [EMAIL]
      );
      if (!rows[0]) throw e;
      created = { user: rows[0], token: null, expires_at: null };
      console.log('Admin user already exists. Proceeding to grant permissions.');
    }

    const perm = await grantAllAdminPermissions(created.user.user_id);
    console.log('Admin role permissions ensured:', perm.granted.length, 'permissions');

    console.log('Admin user:', created.user);
    if (created.token) {
      console.log('JWT:', created.token);
      console.log('Expires at:', created.expires_at);
    }
  } catch (err) {
    console.error('Failed to create/grant admin:', err.message);
  } finally {
    try { await pool.end(); } catch {}
  }
})();