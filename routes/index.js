const express = require('express');
const router = express.Router();

const { defaultLimiter } = require('../middlewares/rateLimiter');

// Global rate limiter for public API
router.use(defaultLimiter);

// Public/user routes
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/user', require('../user/routes'));
router.use('/attractions', require('./attractions.routes'));
router.use('/slots', require('./slots.routes'));
router.use('/bookings', require('./bookings.routes'));
router.use('/addons', require('./addons.routes'));
router.use('/combos', require('./combos.routes'));
router.use('/combo-slots', require('./comboSlots.routes'));
router.use('/coupons', require('./coupons.routes'));
router.use('/offers', require('./offers.routes'));
router.use('/banners', require('../user/routes/banners.routes'));
router.use('/pages', require('./pages.routes'));
router.use('/blogs', require('./blogs.routes'));
router.use('/uploads', require('./uploads.routes'));
router.use('/', require('./combos.public'));
router.use('/', require('./gallery.public'));
router.use('/', require('./pages.public'));
router.use('/', require('./blogs.public'));
// Cart

router.use('/attractions', require('./attractions.routes'));
router.use('/slots', require('./slots.routes'));

// CHANGE THIS LINE: Mount at '/bookings'
router.use('/bookings', require('../user/routes/bookings.routes')); 

router.use('/addons', require('./addons.routes'));
// ...
router.use('/payments', require('./payments.routes'));
router.use('/webhooks', require('./webhooks.routes'));
// Admin routes (protected inside admin/router)
router.use('/admin', require('../admin/routes'));

// Base
router.get('/', (req, res) => res.json({ api: 'SnowCity', version: '1.0.0' }));

module.exports = router;