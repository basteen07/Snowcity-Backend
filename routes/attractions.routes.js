const router = require('express').Router();
const attractionsCtrl = require('../user/controllers/attractions.controller');
const slotsCtrl = require('../user/controllers/slots.controller');

// Public attractions
router.get('/', attractionsCtrl.listAttractions);
router.get('/:id', attractionsCtrl.getAttractionById);

// Convenience: slots for an attraction
router.get('/:id/slots', async (req, res, next) => {
  try {
    req.query.attraction_id = req.params.id;
    return slotsCtrl.listSlots(req, res, next);
  } catch (err) {
    next(err);
  }
});

module.exports = router;