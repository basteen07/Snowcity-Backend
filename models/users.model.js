const { pool } = require('../config/db');
const logger = require('../config/logger');

function mapUser(row) {
  if (!row) return null;
  return {
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    otp_verified: row.otp_verified,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createUser({ name, email, phone = null, password_hash }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, phone, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING user_id, name, email, phone, otp_verified, last_login_at, created_at, updated_at`,
    [name, email, phone, password_hash]
  );
  return mapUser(rows[0]);
}

async function getUserById(user_id) {
  const { rows } = await pool.query(
    `SELECT user_id, name, email, phone, otp_verified, last_login_at, created_at, updated_at
     FROM users WHERE user_id = $1`,
    [user_id]
  );
  return mapUser(rows[0]);
}

async function getUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT user_id, name, email, phone, otp_verified, last_login_at, created_at, updated_at, password_hash
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] ? { ...rows[0] } : null;
}

async function getUserByPhone(phone) {
  const { rows } = await pool.query(
    `SELECT user_id, name, email, phone, otp_verified, last_login_at, created_at, updated_at
     FROM users WHERE phone = $1`,
    [phone]
  );
  return mapUser(rows[0]);
}

async function updateUser(user_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getUserById(user_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    sets.push(`${k} = $${idx + 1}`);
    params.push(v);
  });
  params.push(user_id);

  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = NOW()
     WHERE user_id = $${params.length}
     RETURNING user_id, name, email, phone, otp_verified, last_login_at, created_at, updated_at`,
    params
  );
  return mapUser(rows[0]);
}

async function deleteUser(user_id) {
  const { rowCount } = await pool.query(`DELETE FROM users WHERE user_id = $1`, [user_id]);
  return rowCount > 0;
}

async function setJwt(user_id, { token, expiresAt }) {
  const { rows } = await pool.query(
    `UPDATE users
     SET jwt_token = $1, jwt_expires_at = $2, updated_at = NOW()
     WHERE user_id = $3
     RETURNING user_id, jwt_expires_at`,
    [token, expiresAt, user_id]
  );
  return rows[0] || null;
}

async function clearJwt(user_id) {
  await pool.query(
    `UPDATE users SET jwt_token = NULL, jwt_expires_at = NULL, updated_at = NOW() WHERE user_id = $1`,
    [user_id]
  );
  return true;
}

async function setLastLogin(user_id, ip = null) {
  await pool.query(`UPDATE users SET last_login_at = NOW(), last_ip = $2 WHERE user_id = $1`, [user_id, ip]);
  return true;
}

module.exports = {
  createUser,
  getUserById,
  getUserByEmail,
  getUserByPhone,
  updateUser,
  deleteUser,
  setJwt,
  clearJwt,
  setLastLogin,
};