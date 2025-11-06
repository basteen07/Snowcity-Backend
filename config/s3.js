const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const BUCKET = process.env.S3_BUCKET;

const s3 = new S3Client({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

async function uploadBuffer({ buffer, key, contentType = 'application/octet-stream', acl = 'public-read' }) {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: acl,
    },
  });
  const result = await upload.done();
  return {
    key,
    bucket: BUCKET,
    location: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${encodeURI(key)}`,
    result,
  };
}

async function uploadFile({ filePath, key, contentType }) {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key || path.basename(filePath),
    Body: require('fs').createReadStream(filePath),
    ContentType: contentType,
    ACL: 'public-read',
  });
  await s3.send(cmd);
  return {
    key: cmd.input.Key,
    bucket: BUCKET,
    location: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${encodeURI(cmd.input.Key)}`,
  };
}

async function removeObject(key) {
  const cmd = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
  return s3.send(cmd);
}

async function getSignedObjectUrl(key, expiresIn = 900) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
}

module.exports = {
  s3,
  uploadBuffer,
  uploadFile,
  removeObject,
  getSignedObjectUrl,
  BUCKET,
  REGION,
};