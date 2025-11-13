const router = require('express').Router();
const ctrl = require('../controllers/banners.controller');
const { requirePermissions } = require('../middleware/permissionGuard');
const { createBannerValidator, updateBannerValidator } = require('../../validators/banners.validators');
const validate = require('../../middlewares/validate');

router.get('/', requirePermissions('banners:read'), ctrl.listBanners);
router.get('/:id', requirePermissions('banners:read'), ctrl.getBannerById);
router.post('/', requirePermissions('banners:write'), validate(createBannerValidator), ctrl.createBanner);
router.put('/:id', requirePermissions('banners:write'), validate(updateBannerValidator), ctrl.updateBanner);
router.delete('/:id', requirePermissions('banners:write'), ctrl.deleteBanner);

module.exports = router;