const router = require('express').Router();
const { requirePermissions, requireAnyPermission } = require('../middleware/permissionGuard');
// If you implement a controller later, swap these handlers to controller methods.
const adminModel = require('../models/admin.model');

// Simple analytics using adminModel
router.get(
  '/sales-trend',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  async (req, res, next) => {
    try {
      const { from = null, to = null, granularity = 'day' } = req.query;
      const data = await adminModel.getSalesTrend({ from, to, granularity });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/top-attractions',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  async (req, res, next) => {
    try {
      const { from = null, to = null } = req.query;
      const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
      const data = await adminModel.getTopAttractions({ from, to, limit });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// Placeholder for more advanced analytics endpoints (use analytics.controller in future)
// router.get('/', requirePermissions('analytics:read'), ctrl.getOverview);

module.exports = router;