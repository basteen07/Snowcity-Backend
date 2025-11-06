const router = require('express').Router();
const ctrl = require('../controllers/notifications.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('notifications:read'), ctrl.listNotifications);
router.get('/:id', requirePermissions('notifications:read'), ctrl.getNotificationById);
router.post('/', requirePermissions('notifications:write'), ctrl.createNotification);
router.post('/:id/resend', requirePermissions('notifications:write'), ctrl.resendNotification);
router.delete('/:id', requirePermissions('notifications:write'), ctrl.deleteNotification);

module.exports = router;