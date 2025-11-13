const router = require('express').Router();
const ctrl = require('../user/controllers/gallery.controller');

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);

module.exports = router;
