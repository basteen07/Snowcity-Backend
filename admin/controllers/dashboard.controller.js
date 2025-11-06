const adminModel = require('../models/admin.model');

// GET admin dashboard overview
exports.getOverview = async (req, res, next) => {
  try {
    const { from = null, to = null } = req.query;
    const data = await adminModel.getAdminOverview({ from, to });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// GET recent bookings
exports.getRecentBookings = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const data = await adminModel.getRecentBookings({ limit, offset });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// GET top attractions
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

// GET booking status breakdown
exports.getStatusBreakdown = async (req, res, next) => {
  try {
    const { from = null, to = null } = req.query;
    const data = await adminModel.getBookingCountsByStatus({ from, to });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// GET sales trend
exports.getTrend = async (req, res, next) => {
  try {
    const { from = null, to = null, granularity = 'day' } = req.query;
    const data = await adminModel.getSalesTrend({ from, to, granularity });
    res.json(data);
  } catch (err) {
    next(err);
  }
};