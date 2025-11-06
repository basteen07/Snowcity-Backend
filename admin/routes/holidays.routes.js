const router = require('express').Router();
const ctrl = require('../controllers/holidays.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('holidays:read'), ctrl.listHolidays);
router.post('/', requirePermissions('holidays:write'), ctrl.createHoliday);
router.put('/:id', requirePermissions('holidays:write'), ctrl.updateHoliday);
router.delete('/:id', requirePermissions('holidays:write'), ctrl.deleteHoliday);

module.exports = router;