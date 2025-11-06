const router = require('express').Router();
const ctrl = require('../user/controllers/blogs.controller');

// Public blogs
router.get('/', ctrl.listBlogs);
router.get('/slug/:slug', ctrl.getBlogBySlug);
router.get('/:id', ctrl.getBlogById);

module.exports = router;