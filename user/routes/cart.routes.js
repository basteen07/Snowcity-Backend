const router = require('express').Router();
const ctrl = require('../controllers/cart.controller');
const { optionalAuth, requireAuth } = require('../../middlewares/authMiddleware');

router.get('/', optionalAuth, ctrl.listCart);
router.post('/items', optionalAuth, ctrl.addItem);
router.put('/items/:id', optionalAuth, ctrl.updateItem);
router.delete('/items/:id', optionalAuth, ctrl.removeItem);

router.post('/pay/payphi/initiate', requireAuth, ctrl.initiatePayPhi);
router.get('/pay/payphi/status', requireAuth, ctrl.checkPayPhiStatus);

module.exports = router;
