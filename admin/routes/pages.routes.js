const router = require('express').Router();
const ctrl = require('../controllers/pages.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('pages:read'), ctrl.listPages);
router.get('/:id', requirePermissions('pages:read'), ctrl.getPageById);
router.post('/', requirePermissions('pages:write'), ctrl.createPage);
router.put('/:id', requirePermissions('pages:write'), ctrl.updatePage);
router.delete('/:id', requirePermissions('pages:write'), ctrl.deletePage);

// Preview content (no persistence)
router.post('/preview', requirePermissions('pages:write'), ctrl.previewPage);

module.exports = router;