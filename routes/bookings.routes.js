const express = require('express');
const router = express.Router();
const { defaultLimiter } = require('../middlewares/rateLimiter');
const userRoutes = require('../user/routes/bookings.routes');

// Global rate limiter for this router
router.use(defaultLimiter);

// Mount the actual booking routes
router.use('/', userRoutes);

module.exports = router;
