const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const logger = require('../config/logger');

function getToken(req) {
  const hdr = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(hdr);
  if (m) return m[1];
  if (req.headers['x-access-token']) return req.headers['x-access-token'];
  return null;
}

function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw Object.assign(new Error('JWT secret not configured'), { status: 500 });
  }
  return jwt.verify(token, secret);
}

async function loadUser(userId) {
  const { rows } = await pool.query(
    `SELECT user_id, name, email, phone, otp_verified, jwt_token, jwt_expires_at, last_login_at, created_at, updated_at
     FROM users WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function loadUserRoles(userId) {
  const { rows } = await pool.query(
    `SELECT LOWER(r.role_name) AS role_name
     FROM user_roles ur
     JOIN roles r ON r.role_id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.role_name);
}

async function loadUserPermissions(userId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT LOWER(p.permission_key) AS permission_key
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.permission_id = rp.permission_id
     WHERE ur.user_id = $1`,
    [userId]
  );
  return new Set(rows.map((r) => r.permission_key));
}

async function authenticate(req) {
  const token = getToken(req);
  if (!token) {
    const err = new Error('Unauthorized: Missing token');
    err.status = 401;
    throw err;
  }

  let payload;
  try {
    payload = verifyJwt(token);
  } catch (e) {
    const err = new Error('Unauthorized: Invalid token');
    err.status = 401;
    throw err;
  }

  const userId = payload.sub || payload.user_id || payload.id;
  if (!userId) {
    const err = new Error('Unauthorized: Invalid token payload');
    err.status = 401;
    throw err;
  }

  const user = await loadUser(userId);
  if (!user) {
    const err = new Error('Unauthorized: User not found');
    err.status = 401;
    throw err;
  }

  // Optional server-side JWT invalidation support
  if (user.jwt_token && user.jwt_token !== token) {
    const err = new Error('Unauthorized: Token revoked');
    err.status = 401;
    throw err;
  }
  if (user.jwt_expires_at && new Date(user.jwt_expires_at) < new Date()) {
    const err = new Error('Unauthorized: Token expired');
    err.status = 401;
    throw err;
  }

  // Attach base user; defer roles/permissions until needed
  req.user = {
    id: user.user_id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    otp_verified: user.otp_verified,
    roles: null,
    permissions: null,
    tokenPayload: {
      jti: payload.jti,
      iat: payload.iat,
      exp: payload.exp,
    },
  };

  return req.user;
}

async function ensureRoles(req) {
  if (!req.user) throw Object.assign(new Error('Auth required'), { status: 401 });
  if (!Array.isArray(req.user.roles)) {
    req.user.roles = await loadUserRoles(req.user.id);
  }
  return req.user.roles;
}

async function ensurePermissions(req) {
  if (!req.user) throw Object.assign(new Error('Auth required'), { status: 401 });
  if (!(req.user.permissions instanceof Set)) {
    req.user.permissions = await loadUserPermissions(req.user.id);
  }
  return req.user.permissions;
}

async function optionalAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return next();
    await authenticate(req);
    return next();
  } catch (err) {
    // Do not block the request; just log and continue without req.user
    logger.debug('optionalAuth: token present but invalid/expired', { message: err.message });
    return next();
  }
}

async function requireAuth(req, res, next) {
  try {
    await authenticate(req);
    return next();
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
  }
}

async function requireVerified(req, res, next) {
  try {
    await authenticate(req);
    if (!req.user.otp_verified) {
      return res.status(403).json({ error: 'Forbidden: Phone/OTP not verified' });
    }
    return next();
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
  }
}

module.exports = {
  optionalAuth,
  requireAuth,
  requireVerified,
  ensureRoles,
  ensurePermissions,
};