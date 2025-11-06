const router = require('express').Router();
const ctrl = require('../controllers/banners.controller');

// Public banners
router.get('/', ctrl.listBanners);
router.get('/:id', ctrl.getBannerById);

module.exports = router;