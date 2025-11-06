const router = require('express').Router();
const ctrl = require('../controllers/addons.controller');

// Public
router.get('/', ctrl.listAddons);
router.get('/:id', ctrl.getAddonById);

module.exports = router;