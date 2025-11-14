const jwt = require('jsonwebtoken');
const { pool } = require('../../config/db');
const logger = require('../../config/logger');

const ADMIN_ROLES = new Set(['root', 'admin', 'subadmin', 'superadmin']);
const SUPERUSER_IDS = new Set([1]);

function getToken(req) {
  const hdr = req.headers.authorization || req.headers.Authorization || '';
  const match = hdr.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1];
  // Fallback header
  if (req.headers['x-access-token']) return req.headers['x-access-token'];
  return null;
}

async function loadUser(userId) {
  const { rows } = await pool.query(
    `SELECT user_id, name, email, jwt_token, jwt_expires_at
     FROM users
     WHERE user_id = $1`,
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

function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT secret not configured');
  return jwt.verify(token, secret);
}

// Core admin auth: verifies JWT, loads user + roles, ensures admin/subadmin
async function adminAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    let payload;
    try {
      payload = verifyJwt(token);
    } catch (err) {
      logger.warn('JWT verification failed', { message: err.message });
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const userId = payload.sub || payload.user_id || payload.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }

    const user = await loadUser(userId);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    // Optional: enforce stored JWT and expiry if present (supports logout/invalidation)
    if (user.jwt_token && user.jwt_token !== token) {
      return res.status(401).json({ error: 'Unauthorized: Token revoked' });
    }
    if (user.jwt_expires_at && new Date(user.jwt_expires_at) < new Date()) {
      return res.status(401).json({ error: 'Unauthorized: Token expired' });
    }

    const roles = await loadUserRoles(user.user_id);
    const userIdNum = Number(user.user_id);
    const isSuperUser = !Number.isNaN(userIdNum) && SUPERUSER_IDS.has(userIdNum);
    const hasAdminRole = roles.some((r) => ADMIN_ROLES.has(String(r).toLowerCase()));
    if (!hasAdminRole && !isSuperUser) {
      return res.status(403).json({ error: 'Forbidden: Admin role required' });
    }

    if (isSuperUser && !roles.includes('superuser')) {
      roles.push('superuser');
    }

    // Attach to request
    req.user = {
      id: user.user_id,
      name: user.name,
      email: user.email,
      roles,
      permissions: null, // lazy-loaded in permissionGuard
      tokenPayload: {
        jti: payload.jti,
        iat: payload.iat,
        exp: payload.exp,
      },
    };

    return next();
  } catch (err) {
    logger.error('adminAuth error', { err: err.message });
    return next(err);
  }
}

// Strict admin-only (exclude subadmins)
function requireAdminOnly(req, res, next) {
  if (!req.user || !Array.isArray(req.user.roles)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const isAdmin = req.user.roles.map((r) => String(r).toLowerCase()).includes('admin');
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin only' });
  }
  return next();
}

module.exports = {
  adminAuth,
  requireAdminOnly,
};