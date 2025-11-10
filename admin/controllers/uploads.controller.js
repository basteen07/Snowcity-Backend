const logger = require('../../config/logger');
const { saveToLocal } = require('../../utils/uploader');

function parseBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return defaultValue;
}

exports.uploadSingleImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const folder = req.body?.folder || req.query?.folder || '';
    const optimize = parseBoolean(req.body?.optimize ?? req.query?.optimize, true);

    logger.debug('Admin upload incoming', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      folder,
      optimize,
    });

    const result = await saveToLocal(req.file, { folder, optimize });

    return res.status(201).json({
      url: result.urlPath,
      path: result.relativePath,
      filename: result.filename,
      size: result.size,
      mimetype: result.mimetype,
      folder: result.folder,
    });
  } catch (error) {
    logger.error('Failed to handle admin upload', {
      message: error.message,
      stack: error.stack,
    });
    return next(error);
  }
};
