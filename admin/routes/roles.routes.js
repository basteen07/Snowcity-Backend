const router = require('express').Router();
const ctrl = require('../controllers/roles.controller');
const { requirePermissions, requireAnyPermission } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('roles:read'), ctrl.listRoles);
router.get('/:id', requirePermissions('roles:read'), ctrl.getRoleById);
router.post('/', requirePermissions('roles:write'), ctrl.createRole);
router.put('/:id', requirePermissions('roles:write'), ctrl.updateRole);
router.delete('/:id', requirePermissions('roles:write'), ctrl.deleteRole);

// Role permissions
router.get(
  '/:id/permissions',
  requireAnyPermission('roles:read', 'permissions:read'),
  ctrl.getRolePermissions
);
router.put(
  '/:id/permissions',
  requireAnyPermission('roles:write', 'permissions:write'),
  ctrl.setRolePermissions
);

module.exports = router;