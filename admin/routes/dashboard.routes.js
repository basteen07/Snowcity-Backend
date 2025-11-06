const router = require('express').Router();
const { requireAnyPermission } = require('../middleware/permissionGuard');
const adminModel = require('../models/admin.model');

// Overview: combines summary + charts
router.get(
  '/',
  requireAnyPermission('dashboard:read', 'analytics:read'),
  async (req, res, next) => {
    try {
      const { from = null, to = null } = req.query;
      const data = await adminModel.getAdminOverview({ from, to });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// Recent bookings
router.get(
  '/recent-bookings',
  requireAnyPermission('dashboard:read', 'bookings:read'),
  async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
      const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
      const data = await adminModel.getRecentBookings({ limit, offset });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// Top attractions
router.get(
  '/top-attractions',
  requireAnyPermission('dashboard:read', 'analytics:read'),
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

// Status breakdown
router.get(
  '/status-breakdown',
  requireAnyPermission('dashboard:read', 'analytics:read'),
  async (req, res, next) => {
    try {
      const { from = null, to = null } = req.query;
      const data = await adminModel.getBookingCountsByStatus({ from, to });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// Sales trend
router.get(
  '/trend',
  requireAnyPermission('dashboard:read', 'analytics:read'),
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

module.exports = router;