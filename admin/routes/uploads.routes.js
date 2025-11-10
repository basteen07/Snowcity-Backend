const router = require('express').Router();
const { uploaderImageSingle } = require('../../utils/uploader');
const { uploadSingleImage } = require('../controllers/uploads.controller');
const { requirePermissions } = require('../middleware/permissionGuard');

router.post(
  '/',
  requirePermissions('uploads:write'),
  uploaderImageSingle('file'),
  uploadSingleImage
);

module.exports = router;
