const express = require('express');
const router = require('express').Router();
const { adminAuth } = require('../middleware/adminAuth');



// Protect all admin routes
router.use(adminAuth);

router.get('/', (req, res) => res.json({ admin: true, ok: true }));

// Only mount bookings for now
router.use('/bookings', require('./bookings.routes'));


// Mount sub-routes
router.get('/', (req, res) => res.json({ admin: true, status: 'ok' }));

router.use('/dashboard', require('./dashboard.routes'));
router.use('/users', require('./users.routes'));
router.use('/roles', require('./roles.routes'));
router.use('/permissions', require('./permissions.routes'));
router.use('/settings', require('./settings.routes'));
router.use('/notifications', require('./notifications.routes'));
router.use('/holidays', require('./holidays.routes'));
router.use('/happy-hours', require('./happyHours.routes'));

router.use('/attractions', require('./attractions.routes'));
router.use('/slots', require('./slots.routes'));
router.use('/bookings', require('./bookings.routes'));
router.use('/addons', require('./addons.routes'));
router.use('/combos', require('./combos.routes'));
router.use('/combo-slots', require('./comboSlots.routes'));
router.use('/coupons', require('./coupons.routes'));
router.use('/offers', require('./offers.routes'));
router.use('/banners', require('./banners.routes'));
router.use('/pages', require('./pages.routes'));
router.use('/blogs', require('./blogs.routes'));
router.use('/gallery', require('./gallery.routes'));
router.use('/analytics', require('./analytics.routes'));
router.use('/uploads', require('./uploads.routes'));

module.exports = router;