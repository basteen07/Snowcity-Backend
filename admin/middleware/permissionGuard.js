const { pool } = require('../../config/db');

const BYPASS = String(process.env.DISABLE_ADMIN_PERMISSIONS || 'false').toLowerCase() === 'true';

async function loadPermissions(userId) {
  const { rows } = await pool.query(
    `SELECT LOWER(p.permission_key) AS permission_key
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.permission_id = rp.permission_id
     WHERE ur.user_id = $1`,
    [userId]
  );
  return new Set(rows.map((r) => r.permission_key));
}

async function ensurePermissions(req) {
  if (!req.user) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  if (!req.user.permissions) req.user.permissions = await loadPermissions(req.user.id);
  return req.user.permissions;
}

const pass = () => (req, res, next) => next();

function requirePermissions(...required) {
  if (BYPASS) return pass();
  const needed = required.map((p) => String(p).toLowerCase());
  return async (req, res, next) => {
    try {
      const perms = await ensurePermissions(req);
      const missing = needed.filter((p) => !perms.has(p));
      if (missing.length) return res.status(403).json({ error: 'Forbidden: Missing required permissions', missing });
      next();
    } catch (err) {
      return res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
    }
  };
}

function requireAnyPermission(...candidates) {
  if (BYPASS) return pass();
  const any = candidates.map((p) => String(p).toLowerCase());
  return async (req, res, next) => {
    try {
      const perms = await ensurePermissions(req);
      if (!any.some((p) => perms.has(p))) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions', anyOf: any });
      }
      next();
    } catch (err) {
      return res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
    }
  };
}

function requireRoles(...roles) {
  if (BYPASS) return pass();
  const expect = roles.map((r) => String(r).toLowerCase());
  return (req, res, next) => {
    const userRoles = (req.user?.roles || []).map((r) => String(r).toLowerCase());
    if (!expect.some((r) => userRoles.includes(r))) {
      return res.status(403).json({ error: 'Forbidden: Required role missing', roles: expect });
    }
    next();
  };
}

module.exports = { requirePermissions, requireAnyPermission, requireRoles };