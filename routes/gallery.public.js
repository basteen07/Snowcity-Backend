// site/routes/gallery.public.js
const router = require('express').Router();
const { pool } = require('../config/db');

// Assuming your admin uses gallery_items table (media manager)
router.get('/gallery', async (req, res, next) => {
  try {
    const active = String(req.query.active || '').toLowerCase() === 'true';
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const params = [];
    const where = [];
    if (active) where.push('g.active = TRUE');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT gallery_item_id, media_type, url, title, description, active, created_at
       FROM gallery_items g
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Optionally: /api/gallery/:id
router.get('/gallery/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const { rows } = await pool.query(
      `SELECT gallery_item_id, media_type, url, title, description, active, created_at
       FROM gallery_items WHERE gallery_item_id = $1`,
      [id]
    );
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) { next(err); }
});

module.exports = router;