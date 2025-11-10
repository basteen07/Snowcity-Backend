const router = require('express').Router();
const ctrl = require('../user/controllers/pages.controller');

// Public pages
router.get('/', ctrl.listPages);
router.get('/slug/:slug', ctrl.getPageBySlug);
router.get('/:id', ctrl.getPageById);

module.exports = router;