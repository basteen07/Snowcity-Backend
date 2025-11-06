const express = require('express');
const router = express.Router();

const { defaultLimiter } = require('../middlewares/rateLimiter');

// Global rate limiter for public API
router.use(defaultLimiter);

// Public/user routes
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/attractions', require('./attractions.routes'));
router.use('/slots', require('./slots.routes'));
router.use('/bookings', require('./bookings.routes'));
router.use('/addons', require('./addons.routes'));
router.use('/combos', require('./combos.routes'));
router.use('/coupons', require('./coupons.routes'));
router.use('/offers', require('./offers.routes'));

// ...
router.use('/payments', require('./payments.routes'));
// Admin routes (protected inside admin/router)
router.use('/admin', require('../admin/routes'));

// Base
router.get('/', (req, res) => res.json({ api: 'SnowCity', version: '1.0.0' }));

module.exports = router;