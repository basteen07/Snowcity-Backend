const router = require('express').Router();
const ctrl = require('../controllers/profile.controller');
const validate = require('../../middlewares/validate');
const { requireAuth } = require('../../middlewares/authMiddleware');
const { body } = require('express-validator');

const updateProfileValidator = [
  body('name').optional().isLength({ min: 2, max: 100 }).trim(),
  body('phone').optional().matches(/^[0-9+\-\s()]{7,20}$/),
  body('email').optional().isEmail().normalizeEmail(),
];

// Current user profile
router.get('/', requireAuth, ctrl.getProfile);
router.patch('/', requireAuth, validate(updateProfileValidator), ctrl.updateProfile);

module.exports = router;