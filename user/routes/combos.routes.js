const router = require('express').Router();
const ctrl = require('../controllers/combos.controller');

// Public
router.get('/', ctrl.listCombos);
router.get('/:id', ctrl.getComboById);

module.exports = router;