const router = require('express').Router();
const ctrl = require('../controllers/slots.controller');
const validate = require('../../middlewares/validate');
const { listSlotsQuery } = require('../../validators/slots.validators');

// Public slots lookup
router.get('/', validate(listSlotsQuery), ctrl.listSlots);
router.get('/:id', ctrl.getSlotById);

module.exports = router;