const router = require('express').Router();
const ctrl = require('../controllers/blogs.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.get('/', requirePermissions('blogs:read'), ctrl.listBlogs);
router.get('/:id', requirePermissions('blogs:read'), ctrl.getBlogById);
router.post('/', requirePermissions('blogs:write'), ctrl.createBlog);
router.put('/:id', requirePermissions('blogs:write'), ctrl.updateBlog);
router.delete('/:id', requirePermissions('blogs:write'), ctrl.deleteBlog);

// Preview content (no persistence)
router.post('/preview', requirePermissions('blogs:write'), ctrl.previewBlog);

module.exports = router;