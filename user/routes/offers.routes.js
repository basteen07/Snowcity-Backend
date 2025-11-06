const router = require('express').Router();
const ctrl = require('../controllers/offers.controller');

// Public
router.get('/', ctrl.listOffers);
router.get('/:id', ctrl.getOfferById);

module.exports = router;