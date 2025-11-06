const router = require('express').Router();
const ctrl = require('../controllers/happyHours.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('happyhours:read'), ctrl.listHappyHours);
router.get('/:id', requirePermissions('happyhours:read'), ctrl.getHappyHourById);
router.post('/', requirePermissions('happyhours:write'), ctrl.createHappyHour);
router.put('/:id', requirePermissions('happyhours:write'), ctrl.updateHappyHour);
router.delete('/:id', requirePermissions('happyhours:write'), ctrl.deleteHappyHour);

module.exports = router;