const router = require('express').Router();
const { requirePermissions, requireAnyPermission } = require('../middleware/permissionGuard');
const adminModel = require('../models/admin.model');
const PDFDocument = require('pdfkit');

// Overview (matches frontend Admin endpoints)
router.get(
  '/overview',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  async (req, res, next) => {
    try {
      const { from = null, to = null, attraction_id = null } = req.query;
      const data = await adminModel.getAdminOverview({ from, to, attraction_id: attraction_id ? Number(attraction_id) : null });
      res.json(data);
    } catch (err) { next(err); }
  }
);

// Trend (alias of sales-trend) with optional attraction filter
router.get(
  '/trend',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  async (req, res, next) => {
    try {
      const { from = null, to = null, granularity = 'day', attraction_id = null } = req.query;
      const data = await adminModel.getSalesTrend({ from, to, granularity, attraction_id: attraction_id ? Number(attraction_id) : null });
      res.json(data);
    } catch (err) { next(err); }
  }
);

// Back-compat: sales-trend
router.get(
  '/sales-trend',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  async (req, res, next) => {
    try {
      const { from = null, to = null, granularity = 'day', attraction_id = null } = req.query;
      const data = await adminModel.getSalesTrend({ from, to, granularity, attraction_id: attraction_id ? Number(attraction_id) : null });
      res.json(data);
    } catch (err) { next(err); }
  }
);

router.get(
  '/top-attractions',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  async (req, res, next) => {
    try {
      const { from = null, to = null, attraction_id = null } = req.query;
      const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
      const data = await adminModel.getTopAttractions({ from, to, limit, attraction_id: attraction_id ? Number(attraction_id) : null });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// Export helpers
function toCsv(rows, headers) {
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const head = headers.map((h) => h.label).join(',');
  const body = rows.map((r) => headers.map((h) => escape(h.get(r))).join(',')).join('\n');
  return head + '\n' + body + '\n';
}

async function getReportRows({ type = 'bookings', from = null, to = null, attraction_id = null }) {
  switch (type) {
    case 'top-attractions':
      return await adminModel.getTopAttractions({ from, to, limit: 100, attraction_id });
    case 'trend':
      return await adminModel.getSalesTrend({ from, to, granularity: 'day', attraction_id });
    case 'bookings':
    default:
      return await adminModel.getRecentBookings({ limit: 500, offset: 0, attraction_id });
  }
}

// CSV export
router.get(
  '/report.csv',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  async (req, res, next) => {
    try {
      const { type = 'bookings', from = null, to = null, attraction_id = null } = req.query;
      const rows = await getReportRows({ type, from, to, attraction_id: attraction_id ? Number(attraction_id) : null });
      let headers;
      if (type === 'top-attractions') headers = [
        { label: 'Attraction ID', get: (r) => r.attraction_id },
        { label: 'Title', get: (r) => r.title },
        { label: 'Bookings', get: (r) => r.bookings ?? r.total_bookings },
        { label: 'Revenue', get: (r) => r.revenue ?? r.total_revenue },
      ];
      else if (type === 'trend') headers = [
        { label: 'Bucket', get: (r) => r.bucket },
        { label: 'Bookings', get: (r) => r.bookings },
        { label: 'Revenue', get: (r) => r.revenue },
      ];
      else headers = [
        { label: 'Booking Ref', get: (r) => r.booking_ref },
        { label: 'User Email', get: (r) => r.user_email },
        { label: 'Attraction', get: (r) => r.attraction_title },
        { label: 'Amount', get: (r) => r.final_amount },
        { label: 'Payment', get: (r) => r.payment_status },
        { label: 'Created At', get: (r) => r.created_at },
      ];
      const csv = toCsv(rows, headers);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report_${type}.csv"`);
      res.send(csv);
    } catch (err) { next(err); }
  }
);

// PDF export (simple tabular)
router.get(
  '/report.pdf',
  requireAnyPermission('analytics:read', 'dashboard:read'),
  async (req, res, next) => {
    try {
      const { type = 'bookings', from = null, to = null, attraction_id = null } = req.query;
      const rows = await getReportRows({ type, from, to, attraction_id: attraction_id ? Number(attraction_id) : null });
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report_${type}.pdf"`);
      doc.pipe(res);
      doc.fontSize(16).text(`SnowCity Report — ${type.replace(/-/g,' ')}`, { align: 'left' });
      doc.moveDown();
      doc.fontSize(10);
      const renderRow = (vals) => { doc.text(vals.join('  \t  ')); };
      if (type === 'top-attractions') {
        renderRow(['Attraction ID','Title','Bookings','Revenue']);
        rows.forEach(r => renderRow([String(r.attraction_id), r.title, String(r.bookings ?? r.total_bookings), String(r.revenue ?? r.total_revenue)]));
      } else if (type === 'trend') {
        renderRow(['Bucket','Bookings','Revenue']);
        rows.forEach(r => renderRow([String(r.bucket), String(r.bookings), String(r.revenue)]));
      } else {
        renderRow(['Booking Ref','User Email','Attraction','Amount','Payment','Created At']);
        rows.forEach(r => renderRow([r.booking_ref, r.user_email || '', r.attraction_title || '', String(r.final_amount || 0), r.payment_status || '', String(r.created_at)]));
      }
      doc.end();
    } catch (err) { next(err); }
  }
);

module.exports = router;