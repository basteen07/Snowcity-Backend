    // admin/routes/admins.routes.js
const router = require('express').Router();
const ctrl = require('../controllers/admins.controller');
const { requireRoles } = require('../middleware/permissionGuard');

// Root-only access
router.get('/', requireRoles('root', 'superadmin'), ctrl.listAdmins);
router.post('/', requireRoles('root', 'superadmin'), ctrl.createAdmin);

router.get('/:id/access', requireRoles('root', 'superadmin'), ctrl.getAccess);
router.put('/:id/access', requireRoles('root', 'superadmin'), ctrl.setAccess);

module.exports = router;