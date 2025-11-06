const router = require('express').Router();
const ctrl = require('../controllers/settings.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('settings:read'), ctrl.listSettings);
router.get('/:key', requirePermissions('settings:read'), ctrl.getSetting);
router.post('/', requirePermissions('settings:write'), ctrl.upsertSetting);
router.put('/:key', requirePermissions('settings:write'), ctrl.upsertSetting);
router.delete('/:key', requirePermissions('settings:write'), ctrl.deleteSetting);

module.exports = router;