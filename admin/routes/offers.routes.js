const router = require('express').Router();
const ctrl = require('../controllers/offers.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('offers:read'), ctrl.listOffers);
router.get('/:id', requirePermissions('offers:read'), ctrl.getOfferById);
router.post('/', requirePermissions('offers:write'), ctrl.createOffer);
router.put('/:id', requirePermissions('offers:write'), ctrl.updateOffer);
router.delete('/:id', requirePermissions('offers:write'), ctrl.deleteOffer);

module.exports = router;