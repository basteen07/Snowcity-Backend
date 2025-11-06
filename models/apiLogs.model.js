const { pool } = require('../config/db');

async function createApiLog({ endpoint, payload = null, response_code = 200, status = 'success' }) {
  const { rows } = await pool.query(
    `INSERT INTO api_logs (endpoint, payload, response_code, status)
     VALUES ($1, $2::jsonb, $3, $4)
     RETURNING log_id, endpoint, payload, response_code, status, created_at`,
    [endpoint, payload ? JSON.stringify(payload) : null, response_code, status]
  );
  return rows[0];
}

module.exports = {
  createApiLog,
};