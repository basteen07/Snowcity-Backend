const router = require('express').Router();
const ctrl = require('../controllers/coupons.controller');
const validate = require('../../middlewares/validate');
const { optionalAuth } = require('../../middlewares/authMiddleware');
const { getCouponByCodeParam, applyCouponBody } = require('../../validators/coupons.validators');

// Get by code
router.get('/:code', optionalAuth, validate(getCouponByCodeParam), ctrl.getCouponByCode);

// Apply coupon to cart snapshot
router.post('/apply', optionalAuth, validate(applyCouponBody), ctrl.applyCoupon);

module.exports = router;