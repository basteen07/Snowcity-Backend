const router = require('express').Router();
const { pool } = require('../config/db');

// Read-only public settings (only keys starting with "public.")
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT key_name, key_value
       FROM settings
       WHERE key_name ILIKE 'public.%'
       ORDER BY key_name ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:key', async (req, res, next) => {
  try {
    const key = String(req.params.key);
    const { rows } = await pool.query(
      `SELECT key_name, key_value
       FROM settings
       WHERE key_name = $1 AND key_name ILIKE 'public.%'`,
      [key]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Setting not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

module.exports = router;