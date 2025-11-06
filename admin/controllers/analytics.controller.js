const analyticsModel = require('../../models/analytics.model');
const adminModel = require('../models/admin.model');

// Combined overview: summary + top attractions + trend
exports.getOverview = async (req, res, next) => {
  try {
    const { from = null, to = null, granularity = 'day' } = req.query;
    const [summary, topAttractions, trend] = await Promise.all([
      analyticsModel.getSummary({ from, to }),
      adminModel.getTopAttractions({ from, to, limit: 5 }),
      adminModel.getSalesTrend({ from, to, granularity }),
    ]);
    res.json({ summary, topAttractions, trend });
  } catch (err) {
    next(err);
  }
};

// Raw analytics series per attraction/date window
exports.getAnalytics = async (req, res, next) => {
  try {
    const attraction_id = req.query.attraction_id ? Number(req.query.attraction_id) : null;
    const { from = null, to = null } = req.query;
    const data = await analyticsModel.getAnalytics({ attraction_id, from, to });
    res.json({ data, meta: { count: data.length } });
  } catch (err) {
    next(err);
  }
};

// Sales trend grouped by granularity
exports.getTrend = async (req, res, next) => {
  try {
    const { from = null, to = null, granularity = 'day' } = req.query;
    const data = await adminModel.getSalesTrend({ from, to, granularity });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// Top attractions by bookings/revenue
exports.getTopAttractions = async (req, res, next) => {
  try {
    const { from = null, to = null } = req.query;
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const data = await adminModel.getTopAttractions({ from, to, limit });
    res.json(data);
  } catch (err) {
    next(err);
  }
};