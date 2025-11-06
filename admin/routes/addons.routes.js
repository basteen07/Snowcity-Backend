const router = require('express').Router();
const ctrl = require('../controllers/addons.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('addons:read'), ctrl.listAddons);
router.get('/:id', requirePermissions('addons:read'), ctrl.getAddonById);
router.post('/', requirePermissions('addons:write'), ctrl.createAddon);
router.put('/:id', requirePermissions('addons:write'), ctrl.updateAddon);
router.delete('/:id', requirePermissions('addons:write'), ctrl.deleteAddon);

module.exports = router;