const { ensurePermissions } = require('./authMiddleware');

function requirePermissions(...required) {
  const list = required.map((p) => String(p).toLowerCase());
  return async (req, res, next) => {
    try {
      const perms = await ensurePermissions(req);
      const missing = list.filter((p) => !perms.has(p));
      if (missing.length) {
        return res.status(403).json({ error: 'Forbidden: Missing permissions', missing });
      }
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

function requireAnyPermission(...candidates) {
  const any = candidates.map((p) => String(p).toLowerCase());
  return async (req, res, next) => {
    try {
      const perms = await ensurePermissions(req);
      const ok = any.some((p) => perms.has(p));
      if (!ok) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions', anyOf: any });
      }
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

module.exports = {
  requirePermissions,
  requireAnyPermission,
}; 