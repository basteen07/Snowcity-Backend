const { pool } = require('../config/db');

function map(row) {
  if (!row) return null;
  return {
    gallery_item_id: row.gallery_item_id,
    media_type: row.media_type,
    url: row.url,
    title: row.title,
    description: row.description,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function create({ media_type, url, title = null, description = null, active = true }) {
  const { rows } = await pool.query(
    `INSERT INTO gallery_items (media_type, url, title, description, active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [media_type, url, title, description, active]
  );
  return map(rows[0]);
}

async function getById(id) {
  const { rows } = await pool.query(`SELECT * FROM gallery_items WHERE gallery_item_id = $1`, [id]);
  return map(rows[0]);
}

async function list({ active = null, q = '', limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  let i = 1;
  if (active != null) {
    where.push(`active = $${i++}`);
    params.push(Boolean(active));
  }
  if (q) {
    where.push(`(title ILIKE $${i} OR description ILIKE $${i})`);
    params.push(`%${q}%`);
    i += 1;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM gallery_items ${whereSql} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );
  return rows.map(map);
}

async function update(id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getById(id);
  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    sets.push(`${k} = $${idx + 1}`);
    params.push(v);
  });
  params.push(id);
  const { rows } = await pool.query(
    `UPDATE gallery_items SET ${sets.join(', ')}, updated_at = NOW() WHERE gallery_item_id = $${params.length} RETURNING *`,
    params
  );
  return map(rows[0]);
}

async function remove(id) {
  const { rowCount } = await pool.query(`DELETE FROM gallery_items WHERE gallery_item_id = $1`, [id]);
  return rowCount > 0;
}

module.exports = { create, getById, list, update, remove };
