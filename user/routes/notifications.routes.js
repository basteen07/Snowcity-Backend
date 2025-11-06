const router = require('express').Router();
const ctrl = require('../controllers/notifications.controller');
const { requireAuth } = require('../../middlewares/authMiddleware');

// Current user's notifications
router.get('/', requireAuth, ctrl.listMyNotifications);
router.get('/:id', requireAuth, ctrl.getMyNotificationById);

module.exports = router;