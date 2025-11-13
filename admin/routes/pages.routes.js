const router = require('express').Router();
const ctrlRaw = require('../controllers/pages.controller');
const ctrl = ctrlRaw?.default || ctrlRaw;
const { requirePermissions } = require('../middleware/permissionGuard');

function ensure(fn, name) {
  if (typeof fn !== 'function') {
    throw new Error(`pages.routes: handler "${name}" is not a function (did you export it from pages.controller.js?)`);
  }
  return fn;
}

router.get('/', requirePermissions('pages:read'), ensure(ctrl.listPages, 'listPages'));
router.get('/nav', requirePermissions('pages:read'), ensure(ctrl.listNav, 'listNav'));
router.post('/preview', requirePermissions('pages:write'), ensure(ctrl.previewPage, 'previewPage'));

router.get('/:id', requirePermissions('pages:read'), ensure(ctrl.getPageById, 'getPageById'));
router.post('/', requirePermissions('pages:write'), ensure(ctrl.createPage, 'createPage'));
router.put('/:id', requirePermissions('pages:write'), ensure(ctrl.updatePage, 'updatePage'));
router.delete('/:id', requirePermissions('pages:write'), ensure(ctrl.deletePage, 'deletePage'));

module.exports = router;