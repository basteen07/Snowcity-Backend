const router = require('express').Router();
const ctrl = require('../controllers/slots.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('slots:read'), ctrl.listSlots);
router.get('/:id', requirePermissions('slots:read'), ctrl.getSlotById);
router.post('/', requirePermissions('slots:write'), ctrl.createSlot);
router.post('/bulk', requirePermissions('slots:write'), ctrl.createSlotsBulk);
router.put('/:id', requirePermissions('slots:write'), ctrl.updateSlot);
router.delete('/:id', requirePermissions('slots:write'), ctrl.deleteSlot);

module.exports = router;