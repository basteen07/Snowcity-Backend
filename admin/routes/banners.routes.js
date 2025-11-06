const router = require('express').Router();
const ctrl = require('../controllers/banners.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('banners:read'), ctrl.listBanners);
router.get('/:id', requirePermissions('banners:read'), ctrl.getBannerById);
router.post('/', requirePermissions('banners:write'), ctrl.createBanner);
router.put('/:id', requirePermissions('banners:write'), ctrl.updateBanner);
router.delete('/:id', requirePermissions('banners:write'), ctrl.deleteBanner);

module.exports = router;