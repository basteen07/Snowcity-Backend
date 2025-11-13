const router = require('express').Router();
const { requireAnyPermission } = require('../middleware/permissionGuard');
const adminModel = require('../models/admin.model');

// Helpers
function toIsoOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function intInRange(val, min, max, def) {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}
function nonNegInt(val, def = 0) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}
function sanitizeGranularity(g) {
  const x = String(g || 'day').toLowerCase();
  return ['day', 'week', 'month'].includes(x) ? x : 'day';
}
function handlePgError(err, res, next) {
  // 22P02: invalid_text_representation (e.g., bad integer/date)
  // 23514: check_violation
  // 23503: foreign_key_violation
  const map = new Set(['22P02', '23514', '23503']);
  if (err && map.has(err.code)) {
    return res.status(400).json({ error: err.message, code: err.code });
  }
  return next(err);
}

// Overview: combines summary + charts
router.get(
  '/',
  requireAnyPermission('dashboard:read', 'analytics:read'),
  async (req, res, next) => {
    try {
      const from = toIsoOrNull(req.query.from) || null;
      const to = toIsoOrNull(req.query.to) || null;
      const attraction_id = req.query.attraction_id ? Number(req.query.attraction_id) : null;

      const data = await adminModel.getAdminOverview({ from, to, attraction_id });
      res.json(data);
    } catch (err) {
      handlePgError(err, res, next);
    }
  }
);

// Recent bookings
router.get(
  '/recent-bookings',
  requireAnyPermission('dashboard:read', 'bookings:read'),
  async (req, res, next) => {
    try {
      const limit = intInRange(req.query.limit, 1, 100, 20);
      const offset = nonNegInt(req.query.offset, 0);
      const attraction_id = req.query.attraction_id ? Number(req.query.attraction_id) : null;

      const data = await adminModel.getRecentBookings({ limit, offset, attraction_id });
      res.json(data);
    } catch (err) {
      handlePgError(err, res, next);
    }
  }
);

// Top attractions
router.get(
  '/top-attractions',
  requireAnyPermission('dashboard:read', 'analytics:read'),
  async (req, res, next) => {
    try {
      const from = toIsoOrNull(req.query.from) || null;
      const to = toIsoOrNull(req.query.to) || null;
      const limit = intInRange(req.query.limit, 1, 50, 10);
      const attraction_id = req.query.attraction_id ? Number(req.query.attraction_id) : null;

      const data = await adminModel.getTopAttractions({ from, to, limit, attraction_id });
      res.json(data);
    } catch (err) {
      handlePgError(err, res, next);
    }
  }
);

// Status breakdown
router.get(
  '/status-breakdown',
  requireAnyPermission('dashboard:read', 'analytics:read'),
  async (req, res, next) => {
    try {
      const from = toIsoOrNull(req.query.from) || null;
      const to = toIsoOrNull(req.query.to) || null;
      const attraction_id = req.query.attraction_id ? Number(req.query.attraction_id) : null;

      const data = await adminModel.getBookingCountsByStatus({ from, to, attraction_id });
      res.json(data);
    } catch (err) {
      handlePgError(err, res, next);
    }
  }
);

// Sales trend
router.get(
  '/trend',
  requireAnyPermission('dashboard:read', 'analytics:read'),
  async (req, res, next) => {
    try {
      const from = toIsoOrNull(req.query.from) || null;
      const to = toIsoOrNull(req.query.to) || null;
      const granularity = sanitizeGranularity(req.query.granularity);
      const attraction_id = req.query.attraction_id ? Number(req.query.attraction_id) : null;

      const data = await adminModel.getSalesTrend({ from, to, granularity, attraction_id });
      res.json(data);
    } catch (err) {
      handlePgError(err, res, next);
    }
  }
);

module.exports = router;