// admin/middleware/scopes.js
const { pool } = require('../../config/db');

function isRoot(req) {
  const roles = (req.user?.roles || []).map((r) => String(r).toLowerCase());
  return roles.includes('root') || roles.includes('superadmin');
}

async function attachScopes(req, res, next) {
  try {
    if (!req.user?.id) return next();
    if (isRoot(req)) {
      req.user.allAccess = true;
      req.user.scopes = {};
      return next();
    }
    const { rows } = await pool.query(
      `SELECT resource_type, resource_id FROM admin_access WHERE user_id = $1`,
      [req.user.id]
    );
    const map = {};
    for (const r of rows) {
      if (!map[r.resource_type]) map[r.resource_type] = new Set();
      map[r.resource_type].add(Number(r.resource_id));
    }
    req.user.scopes = Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, Array.from(v)])
    );
    next();
  } catch (err) { next(err); }
}

module.exports = { attachScopes, isRoot };