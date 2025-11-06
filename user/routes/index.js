const router = require('express').Router();

// Health for this group
router.get('/', (req, res) => res.json({ userApi: 'ok' }));

router.use('/auth', require('./auth.routes'));
router.use('/profile', require('./profile.routes'));
router.use('/attractions', require('./attractions.routes'));
router.use('/slots', require('./slots.routes'));
router.use('/bookings', require('./bookings.routes'));
router.use('/addons', require('./addons.routes'));
router.use('/combos', require('./combos.routes'));
router.use('/coupons', require('./coupons.routes'));
router.use('/offers', require('./offers.routes'));
router.use('/banners', require('./banners.routes'));
router.use('/pages', require('./pages.routes'));
router.use('/blogs', require('./blogs.routes'));
router.use('/notifications', require('./notifications.routes'));

module.exports = router;