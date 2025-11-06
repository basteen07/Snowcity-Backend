const router = require('express').Router();
const adminModel = require('../admin/models/admin.model');

// Public analytics (read-only)
// Time-series sales trend
router.get('/trend', async (req, res, next) => {
  try {
    const { from = null, to = null, granularity = 'day' } = req.query;
    const data = await adminModel.getSalesTrend({ from, to, granularity });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Top attractions by bookings/revenue
router.get('/top-attractions', async (req, res, next) => {
  try {
    const { from = null, to = null } = req.query;
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const data = await adminModel.getTopAttractions({ from, to, limit });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;