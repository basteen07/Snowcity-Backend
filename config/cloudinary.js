const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true,
});

async function uploadImage({ filePath, folder = process.env.CLOUDINARY_FOLDER || 'snowcity', public_id, overwrite = true }) {
  const res = await cloudinary.uploader.upload(filePath, {
    folder,
    public_id,
    overwrite,
    resource_type: 'image',
  });
  return res;
}

async function uploadBuffer({ buffer, folder = process.env.CLOUDINARY_FOLDER || 'snowcity', public_id, overwrite = true }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id, overwrite, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

function getPublicUrl(publicId, options = {}) {
  return cloudinary.url(publicId, { secure: true, ...options });
}

module.exports = {
  cloudinary,
  uploadImage,
  uploadBuffer,
  getPublicUrl,
};