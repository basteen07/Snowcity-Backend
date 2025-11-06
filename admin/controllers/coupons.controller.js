const couponsModel = require('../../models/coupons.model');

exports.listCoupons = async (req, res, next) => {
  try {
    const active = req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const attraction_id = req.query.attraction_id ? Number(req.query.attraction_id) : null;
    const date = req.query.date || null;
    const q = (req.query.q || '').toString().trim();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const data = await couponsModel.listCoupons({ active, attraction_id, date, q, limit, offset });
    res.json({ data, meta: { page, limit, count: data.length } });
  } catch (err) {
    next(err);
  }
};

exports.getCouponById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await couponsModel.getCouponById(id);
    if (!row) return res.status(404).json({ error: 'Coupon not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.createCoupon = async (req, res, next) => {
  try {
    const row = await couponsModel.createCoupon(req.body || {});
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

exports.updateCoupon = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await couponsModel.updateCoupon(id, req.body || {});
    if (!row) return res.status(404).json({ error: 'Coupon not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.deleteCoupon = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ok = await couponsModel.deleteCoupon(id);
    if (!ok) return res.status(404).json({ error: 'Coupon not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};