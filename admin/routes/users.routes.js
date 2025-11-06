const router = require('express').Router();
const ctrl = require('../controllers/users.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('users:read'), ctrl.listUsers);
router.get('/:id', requirePermissions('users:read'), ctrl.getUserById);
router.post('/', requirePermissions('users:write'), ctrl.createUser);
router.put('/:id', requirePermissions('users:write'), ctrl.updateUser);
router.delete('/:id', requirePermissions('users:write'), ctrl.deleteUser);

module.exports = router;