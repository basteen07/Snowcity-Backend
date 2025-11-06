const couponService = require('../../services/couponService');

// GET /api/coupons/:code
exports.getCouponByCode = async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim();
    const onDate = req.query.onDate || null;
    const attraction_id = req.query.attraction_id ? Number(req.query.attraction_id) : null;
    const row = await couponService.getByCode(code, { activeOnly: true, onDate, attraction_id });
    if (!row) return res.status(404).json({ error: 'Coupon not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

// POST /api/coupons/apply
exports.applyCoupon = async (req, res, next) => {
  try {
    const { code, total_amount, onDate = null } = req.body || {};
    if (!code || total_amount == null) {
      return res.status(400).json({ error: 'code and total_amount are required' });
    }
    const out = await couponService.applyCoupon({ code, total_amount, onDate });
    res.json(out);
  } catch (err) {
    next(err);
  }
};