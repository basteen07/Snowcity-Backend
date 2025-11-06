const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function sign(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, ...options });
}

function verify(token) {
  return jwt.verify(token, JWT_SECRET);
}

function decode(token) {
  return jwt.decode(token, { complete: false });
}

function getBearerToken(req) {
  const hdr = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(hdr);
  if (m) return m[1];
  if (req.headers['x-access-token']) return req.headers['x-access-token'];
  return null;
}

module.exports = {
  sign,
  verify,
  decode,
  getBearerToken,
  JWT_EXPIRES_IN,
};