const router = require('express').Router();
const ctrl = require('../user/controllers/coupons.controller');
const { optionalAuth } = require('../middlewares/authMiddleware');

// List active coupons
router.get('/', optionalAuth, ctrl.listCoupons);

// Validate a coupon by code
router.get('/:code', optionalAuth, ctrl.getCouponByCode);

// Apply coupon to a cart (expects body: items/totals)
router.post('/apply', optionalAuth, ctrl.applyCoupon);

module.exports = router;