const router = require('express').Router();
const ctrl = require('../controllers/permissions.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('permissions:read'), ctrl.listPermissions);
router.get('/:id', requirePermissions('permissions:read'), ctrl.getPermissionById);
router.post('/', requirePermissions('permissions:write'), ctrl.createPermission);
router.put('/:id', requirePermissions('permissions:write'), ctrl.updatePermission);
router.delete('/:id', requirePermissions('permissions:write'), ctrl.deletePermission);

module.exports = router;