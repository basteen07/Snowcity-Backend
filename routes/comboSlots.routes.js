const router = require('express').Router();
const ctrl = require('../user/controllers/comboSlots.controller');
const validate = require('../middlewares/validate');
const { listComboSlotsQuery } = require('../validators/comboSlots.validators');

router.get('/', validate(listComboSlotsQuery), ctrl.listSlots);
router.get('/:id', ctrl.getSlotById);

module.exports = router;
