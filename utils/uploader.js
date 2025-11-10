const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs/promises');

const { IMAGE_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } = require('./constants');
const s3 = require('../services/storage/s3Service');
const cloud = require('../services/storage/cloudinaryService');

const memoryStorage = multer.memoryStorage();

function imageFilter(req, file, cb) {
  if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('Only image uploads are allowed'), false);
  }
  cb(null, true);
}

function uploaderImageSingle(field = 'file') {
  return multer({
    storage: memoryStorage,
    fileFilter: imageFilter,
    limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  }).single(field);
}

function uploaderImageArray(field = 'files', maxCount = 10) {
  return multer({
    storage: memoryStorage,
    fileFilter: imageFilter,
    limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  }).array(field, maxCount);
}

async function processImage(buffer, { maxWidth = 1600, format = 'jpeg', quality = 80 } = {}) {
  const pipeline = sharp(buffer).rotate(); // auto-orient
  if (maxWidth) {
    pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }
  switch (format) {
    case 'png':
      return pipeline.png({ compressionLevel: 9 }).toBuffer();
    case 'webp':
      return pipeline.webp({ quality });
    default:
      return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
  }
}

function guessExt(mime) {
  switch (mime) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.jpg';
  }
}

function datePrefix() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

function sanitizeFolder(folder = '') {
  return String(folder || '')
    .split(/[\\/]+/)
    .filter(Boolean)
    .map((segment) =>
      segment
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
    )
    .filter(Boolean)
    .join('/');
}

async function saveToLocal(
  file,
  { folder = '', optimize = true, baseDir = path.resolve(__dirname, '..', 'uploads') } = {}
) {
  if (!file || !file.buffer) throw new Error('No file buffer');

  const buf = optimize ? await processImage(file.buffer) : file.buffer;
  const ext = guessExt(file.mimetype);
  const sanitizedFolder = sanitizeFolder(folder);
  const relativeDirParts = [];
  if (sanitizedFolder) {
    relativeDirParts.push(sanitizedFolder);
  }
  relativeDirParts.push(datePrefix());

  const relativeDir = relativeDirParts.join('/');
  const absoluteDir = path.join(baseDir, ...relativeDir.split('/'));
  await fs.mkdir(absoluteDir, { recursive: true });

  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const absolutePath = path.join(absoluteDir, filename);
  await fs.writeFile(absolutePath, buf);

  const relativePath = path.posix.join(relativeDir, filename);
  return {
    urlPath: path.posix.join('/uploads', relativePath),
    relativePath,
    absolutePath,
    filename,
    size: buf.length,
    mimetype: file.mimetype,
    folder: sanitizedFolder,
  };
}

async function saveToS3(file, { folder = 'uploads', optimize = true } = {}) {
  if (!file || !file.buffer) throw new Error('No file buffer');
  const buf = optimize ? await processImage(file.buffer) : file.buffer;
  const ext = guessExt(file.mimetype);
  const key = path.posix.join(folder, datePrefix(), `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);

  const uploaded = await s3.uploadBuffer({
    buffer: buf,
    key,
    contentType: file.mimetype,
  });

  return {
    url: uploaded.location,
    key: uploaded.key,
    bucket: uploaded.bucket,
  };
}

async function saveToCloudinary(file, { folder = process.env.CLOUDINARY_FOLDER || 'snowcity', optimize = true } = {}) {
  if (!file || !file.buffer) throw new Error('No file buffer');
  const buf = optimize ? await processImage(file.buffer) : file.buffer;
  const res = await cloud.uploadBuffer({ buffer: buf, folder });
  return {
    url: res.secure_url || res.url,
    public_id: res.public_id,
    width: res.width,
    height: res.height,
    format: res.format,
  };
}

module.exports = {
  uploaderImageSingle,
  uploaderImageArray,
  saveToS3,
  saveToCloudinary,
  processImage,
  saveToLocal,
};