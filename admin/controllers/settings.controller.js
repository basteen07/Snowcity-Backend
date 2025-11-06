const { pool } = require('../../config/db');

const isUniqueViolation = (err) => err && err.code === '23505';

exports.listSettings = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT setting_id, key_name, key_value, created_at, updated_at
       FROM settings
       ORDER BY LOWER(key_name)`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.getSetting = async (req, res, next) => {
  try {
    const key = String(req.params.key || '');
    const { rows } = await pool.query(
      `SELECT setting_id, key_name, key_value, created_at, updated_at
       FROM settings WHERE LOWER(key_name) = LOWER($1)`,
      [key]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Setting not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.upsertSetting = async (req, res, next) => {
  try {
    const key_name = String(req.body.key_name || req.params.key || '').trim();
    const key_value = req.body.key_value != null ? String(req.body.key_value) : '';
    if (!key_name) return res.status(400).json({ error: 'key_name is required' });

    const { rows } = await pool.query(
      `INSERT INTO settings (key_name, key_value)
       VALUES ($1, $2)
       ON CONFLICT (key_name) DO UPDATE
       SET key_value = EXCLUDED.key_value, updated_at = NOW()
       RETURNING setting_id, key_name, key_value, created_at, updated_at`,
      [key_name, key_value]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'Duplicate key_name' });
    }
    next(err);
  }
};

exports.deleteSetting = async (req, res, next) => {
  try {
    const key = String(req.params.key || '');
    const { rowCount } = await pool.query(`DELETE FROM settings WHERE LOWER(key_name) = LOWER($1)`, [key]);
    if (rowCount === 0) return res.status(404).json({ error: 'Setting not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};