const router = require('express').Router();
const attractionsCtrl = require('../controllers/attractions.controller');
const slotsCtrl = require('../controllers/slots.controller');
const validate = require('../../middlewares/validate');
const { listAttractionsQuery } = require('../../validators/attractions.validators');

// Public list and detail
router.get('/', validate(listAttractionsQuery), attractionsCtrl.listAttractions);
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