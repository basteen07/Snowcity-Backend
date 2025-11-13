const router = require('express').Router();
const ctrl = require('../controllers/comboSlots.controller');
const { requirePermissions } = require('../middleware/permissionGuard');
const validate = require('../../middlewares/validate');
const {
  listComboSlotsQuery,
  createComboSlotValidator,
  updateComboSlotValidator,
} = require('../../validators/comboSlots.validators');

router.get('/', requirePermissions('combos:read'), validate(listComboSlotsQuery), ctrl.listSlots);
router.get('/:id', requirePermissions('combos:read'), ctrl.getSlotById);
router.post('/', requirePermissions('combos:write'), validate(createComboSlotValidator), ctrl.createSlot);
router.put('/:id', requirePermissions('combos:write'), validate(updateComboSlotValidator), ctrl.updateSlot);
router.delete('/:id', requirePermissions('combos:write'), ctrl.deleteSlot);

module.exports = router;
