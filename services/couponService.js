const couponsModel = require('../models/coupons.model');

async function getByCode(code, { activeOnly = true, onDate = null, attraction_id = null } = {}) {
  return couponsModel.getCouponByCode(code, { activeOnly, onDate, attraction_id });
}

async function applyCoupon({ code, total_amount, onDate = null }) {
  const coupon = await couponsModel.getCouponByCode(code, { activeOnly: true, onDate });
  const { discount, reason } = await couponsModel.computeDiscount(coupon, total_amount);
  return { coupon, discount, reason };
}

async function list({ active = null, attraction_id = null, date = null, q = '', limit = 50, offset = 0 } = {}) {
  return couponsModel.listCoupons({ active, attraction_id, date, q, limit, offset });
}

module.exports = {
  getByCode,
  applyCoupon,
  list,
};