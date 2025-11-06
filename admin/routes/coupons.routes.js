const router = require('express').Router();
const ctrl = require('../controllers/coupons.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('coupons:read'), ctrl.listCoupons);
router.get('/:id', requirePermissions('coupons:read'), ctrl.getCouponById);
router.post('/', requirePermissions('coupons:write'), ctrl.createCoupon);
router.put('/:id', requirePermissions('coupons:write'), ctrl.updateCoupon);
router.delete('/:id', requirePermissions('coupons:write'), ctrl.deleteCoupon);

module.exports = router;