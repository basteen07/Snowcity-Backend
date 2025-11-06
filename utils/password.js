const bcrypt = require('bcryptjs');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

async function hashPassword(plain) {
  return bcrypt.hash(String(plain), SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(String(plain), String(hash || ''));
}

module.exports = {
  hashPassword,
  comparePassword,
  SALT_ROUNDS,
};