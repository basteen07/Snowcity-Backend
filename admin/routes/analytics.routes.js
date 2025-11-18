// admin/routes/analytics.routes.js
const router = require('express').Router();
const { requireAnyPermission } = require('../middleware/permissionGuard');
const adminModel = require('../models/admin.model');
const analyticsCtrl = require('../controllers/analytics.controller');
const PDFDocument = require('pdfkit');

router.get(
  '/',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  analyticsCtrl.getAnalytics
);

router.get(
  '/overview',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  analyticsCtrl.getOverview
);

router.get(
  '/trend',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  analyticsCtrl.getTrend
);

router.get(
  '/top-attractions',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  analyticsCtrl.getTopAttractions
);

router.get(
  '/attractions-breakdown',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  async (req, res, next) => {
    try {
      const { from = null, to = null } = req.query;
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
      const data = await adminModel.getAttractionBreakdown({ from, to, limit });
      res.json(data);
    } catch (err) { next(err); }
  }
);

// Daily is just trend with granularity=day
router.get(
  '/daily',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  async (req, res, next) => {
    try {
      const { from = null, to = null } = req.query;
      const data = await adminModel.getSalesTrend({ from, to, granularity: 'day' });
      res.json(data);
    } catch (err) { next(err); }
  }
);

// Split data
router.get(
  '/split',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  async (req, res, next) => {
    try {
      const { from = null, to = null, group_by = 'payment_status' } = req.query;
      const data = await adminModel.getSplitData({ from, to, group_by });
      res.json({ group_by, data });
    } catch (err) { next(err); }
  }
);

// CSV export helpers (extend)
function toCsv(rows, headers) {
  const escape = (v) => {
    if (v == null) return '';
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // mitigate CSV injection
    if (s.includes('"')) s = s.replace(/"/g, '""');
    if (s.includes(',') || s.includes('\n')) s = `"${s}"`;
    return s;
  };
  const head = headers.map((h) => h.label).join(',');
  const body = rows.map((r) => headers.map((h) => escape(h.get(r))).join(',')).join('\n');
  return head + '\n' + body + '\n';
}

async function getReportRows({ type = 'bookings', from = null, to = null, attraction_id = null, group_by = 'payment_status' }) {
  switch (type) {
    case 'top-attractions':
      return await adminModel.getTopAttractions({ from, to, limit: 100, attraction_id });
    case 'trend':
    case 'daily':
      return await adminModel.getSalesTrend({ from, to, granularity: 'day', attraction_id });
    case 'attractions-breakdown':
      return await adminModel.getAttractionBreakdown({ from, to, limit: 500 });
    case 'split':
      return (await adminModel.getSplitData({ from, to, group_by })) || [];
    case 'bookings':
    default:
      return await adminModel.getRecentBookings({ limit: 500, offset: 0, attraction_id });
  }
}

router.get(
  '/report.csv',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  async (req, res, next) => {
    try {
      const { type = 'bookings', from = null, to = null, attraction_id = null, group_by = 'payment_status' } = req.query;
      const rows = await getReportRows({ type, from, to, attraction_id: attraction_id ? Number(attraction_id) : null, group_by });
      let headers;

      if (type === 'top-attractions' || type === 'attractions-breakdown') {
        headers = [
          { label: 'Attraction ID', get: (r) => r.attraction_id },
          { label: 'Title', get: (r) => r.title },
          { label: 'Bookings', get: (r) => r.bookings ?? r.total_bookings },
          { label: 'People', get: (r) => r.people ?? r.total_people ?? '' },
          { label: 'Revenue', get: (r) => r.revenue ?? r.total_revenue },
        ];
      } else if (type === 'trend' || type === 'daily') {
        headers = [
          { label: 'Bucket', get: (r) => r.bucket },
          { label: 'Bookings', get: (r) => r.bookings },
          { label: 'People', get: (r) => r.people ?? '' },
          { label: 'Revenue', get: (r) => r.revenue },
        ];
      } else if (type === 'split') {
        headers = [
          { label: 'Key', get: (r) => r.key },
          { label: 'Bookings', get: (r) => r.bookings },
          { label: 'People', get: (r) => r.people ?? '' },
          { label: 'Revenue', get: (r) => r.revenue },
        ];
      } else {
        headers = [
          { label: 'Booking Ref', get: (r) => r.booking_ref },
          { label: 'User Email', get: (r) => r.user_email },
          { label: 'Attraction', get: (r) => r.attraction_title },
          { label: 'Amount', get: (r) => r.final_amount },
          { label: 'Payment', get: (r) => r.payment_status },
          { label: 'Created At', get: (r) => r.created_at },
        ];
      }
      const csv = toCsv(rows, headers);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report_${type}.csv"`);
      res.send(csv);
    } catch (err) { next(err); }
  }
);

module.exports = router;