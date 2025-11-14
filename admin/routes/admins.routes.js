    // admin/routes/admins.routes.js
const router = require('express').Router();
const ctrl = require('../controllers/admins.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

// Admin management permissions
router.get('/', requirePermissions('admin-management:read'), ctrl.listAdmins);
router.post('/', requirePermissions('admin-management:write'), ctrl.createAdmin);

router.get('/:id/access', requirePermissions('admin-management:read'), ctrl.getAccess);
router.put('/:id/access', requirePermissions('admin-management:write'), ctrl.setAccess);

module.exports = router;