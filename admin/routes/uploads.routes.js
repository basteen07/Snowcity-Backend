const router = require('express').Router();
const { uploaderImageSingle } = require('../../utils/uploader');
const { uploadSingleImage } = require('../controllers/uploads.controller');

router.post('/', uploaderImageSingle('file'), uploadSingleImage);

module.exports = router;
