// admin/utils/access.js

// Root/superadmin bypass for resource scoping
function isRoot(req) {
  const roles = (req.user?.roles || []).map((r) => String(r).toLowerCase());
  return roles.includes('root') || roles.includes('superadmin');
}

// Return scoped ID array for a resource type or undefined for root (no restriction)
// Example types: 'attraction','combo','banner','page','blog','gallery'
function scopedIds(req, type) {
  if (isRoot(req)) return undefined; // undefined => no restriction
  const ids = req.user?.scopes?.[type] || [];
  return ids;
}

// Guard helper: 403 if the specific id is not in scope (no-op for root)
function assertAllowedOr403(req, res, type, id) {
  if (isRoot(req)) return true;
  const list = req.user?.scopes?.[type] || [];
  if (!list.includes(Number(id))) {
    res.status(403).json({ error: `Forbidden: ${type} ${id} not in scope` });
    return false;
  }
  return true;
}

module.exports = { isRoot, scopedIds, assertAllowedOr403 };