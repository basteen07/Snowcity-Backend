const router = require('express').Router();
const slotsCtrl = require('../user/controllers/slots.controller');

// Query params: attraction_id, date, start_date/end_date
router.get('/', slotsCtrl.listSlots);
router.get('/:id', slotsCtrl.getSlotById);

module.exports = router;