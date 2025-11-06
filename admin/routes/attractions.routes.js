const router = require('express').Router();
const ctrl = require('../controllers/attractions.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('attractions:read'), ctrl.listAttractions);
router.get('/:id', requirePermissions('attractions:read'), ctrl.getAttractionById);
router.post('/', requirePermissions('attractions:write'), ctrl.createAttraction);
router.put('/:id', requirePermissions('attractions:write'), ctrl.updateAttraction);
router.delete('/:id', requirePermissions('attractions:write'), ctrl.deleteAttraction);

module.exports = router;