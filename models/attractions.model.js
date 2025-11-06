const { pool } = require('../config/db');

async function createAttraction(payload) {
  const {
    title,
    slug = null,
    description = null,
    image_url = null,
    gallery = [],
    base_price = 0,
    price_per_hour = 0,
    discount_percent = 0,
    active = true,
    badge = null,
    video_url = null,
    slot_capacity = 0,
  } = payload;

  const { rows } = await pool.query(
    `INSERT INTO attractions
     (title, slug, description, image_url, gallery, base_price, price_per_hour, discount_percent, active, badge, video_url, slot_capacity)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      title,
      slug,
      description,
      image_url,
      JSON.stringify(gallery || []),
      base_price,
      price_per_hour,
      discount_percent,
      active,
      badge,
      video_url,
      slot_capacity,
    ]
  );
  return rows[0];
}

async function getAttractionById(attraction_id) {
  const { rows } = await pool.query(`SELECT * FROM attractions WHERE attraction_id = $1`, [attraction_id]);
  return rows[0] || null;
}

async function listAttractions({ search = '', active = null, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (search) {
    where.push(`(title ILIKE $${i} OR description ILIKE $${i})`);
    params.push(`%${search}%`);
    i += 1;
  }
  if (active != null) {
    where.push(`active = $${i}`);
    params.push(Boolean(active));
    i += 1;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT * FROM attractions
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );
  return rows;
}

async function updateAttraction(attraction_id, fields = {}) {
  if (fields.gallery) fields.gallery = JSON.stringify(fields.gallery);
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getAttractionById(attraction_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    const col = k === 'gallery' ? `${k} = $${idx + 1}::jsonb` : `${k} = $${idx + 1}`;
    sets.push(col);
    params.push(v);
  });
  params.push(attraction_id);

  const { rows } = await pool.query(
    `UPDATE attractions SET ${sets.join(', ')}, updated_at = NOW()
     WHERE attraction_id = $${params.length}
     RETURNING *`,
    params
  );
  return rows[0] || null;
}

async function deleteAttraction(attraction_id) {
  const { rowCount } = await pool.query(`DELETE FROM attractions WHERE attraction_id = $1`, [attraction_id]);
  return rowCount > 0;
}

async function setActive(attraction_id, active) {
  const { rows } = await pool.query(
    `UPDATE attractions SET active = $1, updated_at = NOW() WHERE attraction_id = $2 RETURNING *`,
    [Boolean(active), attraction_id]
  );
  return rows[0] || null;
}

module.exports = {
  createAttraction,
  getAttractionById,
  listAttractions,
  updateAttraction,
  deleteAttraction,
  setActive,
};