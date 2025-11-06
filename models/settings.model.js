const { pool } = require('../config/db');

function mapSetting(row) {
  if (!row) return null;
  return {
    setting_id: row.setting_id,
    key_name: row.key_name,
    key_value: row.key_value,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listSettings() {
  const { rows } = await pool.query(
    `SELECT setting_id, key_name, key_value, created_at, updated_at
     FROM settings
     ORDER BY LOWER(key_name)`
  );
  return rows.map(mapSetting);
}

async function listPublicSettings() {
  const { rows } = await pool.query(
    `SELECT key_name, key_value
     FROM settings
     WHERE key_name ILIKE 'public.%'
     ORDER BY key_name ASC`
  );
  return rows;
}

async function getSetting(key_name) {
  const { rows } = await pool.query(
    `SELECT setting_id, key_name, key_value, created_at, updated_at
     FROM settings WHERE LOWER(key_name) = LOWER($1)`,
    [key_name]
  );
  return mapSetting(rows[0]);
}

async function setSetting(key_name, key_value) {
  const { rows } = await pool.query(
    `INSERT INTO settings (key_name, key_value)
     VALUES ($1, $2)
     ON CONFLICT (key_name) DO UPDATE
     SET key_value = EXCLUDED.key_value, updated_at = NOW()
     RETURNING setting_id, key_name, key_value, created_at, updated_at`,
    [key_name, String(key_value)]
  );
  return mapSetting(rows[0]);
}

async function deleteSetting(key_name) {
  const { rowCount } = await pool.query(`DELETE FROM settings WHERE LOWER(key_name) = LOWER($1)`, [key_name]);
  return rowCount > 0;
}

module.exports = {
  listSettings,
  listPublicSettings,
  getSetting,
  setSetting,
  deleteSetting,
};