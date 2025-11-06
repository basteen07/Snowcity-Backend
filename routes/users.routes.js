const router = require('express').Router();
const { requireAuth } = require('../middlewares/authMiddleware');

const profileCtrl = require('../user/controllers/profile.controller');
const bookingsCtrl = require('../user/controllers/bookings.controller');
const notificationsCtrl = require('../user/controllers/notifications.controller');

// Current user utilities
router.get('/me', requireAuth, profileCtrl.getProfile);
router.patch('/me', requireAuth, profileCtrl.updateProfile);
router.get('/me/bookings', requireAuth, bookingsCtrl.listMyBookings);
router.get('/me/bookings/:id', requireAuth, bookingsCtrl.getMyBookingById);
router.get('/me/notifications', requireAuth, notificationsCtrl.listMyNotifications);

module.exports = router;