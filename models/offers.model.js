const { pool } = require('../config/db');

function mapOffer(row) {
  if (!row) return null;
  return {
    offer_id: row.offer_id,
    title: row.title,
    description: row.description,
    image_url: row.image_url,
    rule_type: row.rule_type,
    discount_percent: row.discount_percent,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createOffer({
  title,
  description = null,
  image_url = null,
  rule_type = null,
  discount_percent = 0,
  valid_from = null,
  valid_to = null,
  active = true,
}) {
  const { rows } = await pool.query(
    `INSERT INTO offers (title, description, image_url, rule_type, discount_percent, valid_from, valid_to, active)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8)
     RETURNING *`,
    [title, description, image_url, rule_type, discount_percent, valid_from, valid_to, active]
  );
  return mapOffer(rows[0]);
}

async function getOfferById(offer_id) {
  const { rows } = await pool.query(`SELECT * FROM offers WHERE offer_id = $1`, [offer_id]);
  return mapOffer(rows[0]);
}

async function listOffers({ active = null, rule_type = null, date = null, q = '', limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (active != null) {
    where.push(`active = $${i++}`);
    params.push(Boolean(active));
  }
  if (rule_type) {
    where.push(`rule_type = $${i++}`);
    params.push(rule_type);
  }
  if (date) {
    where.push(`(valid_from IS NULL OR valid_from <= $${i}::date) AND (valid_to IS NULL OR valid_to >= $${i}::date)`);
    params.push(date);
    i += 1;
  }
  if (q) {
    where.push(`(title ILIKE $${i} OR description ILIKE $${i})`);
    params.push(`%${q}%`);
    i += 1;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM offers
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );
  return rows.map(mapOffer);
}

async function updateOffer(offer_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getOfferById(offer_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    const cast = ['valid_from', 'valid_to'].includes(k) ? '::date' : '';
    sets.push(`${k} = $${idx + 1}${cast}`);
    params.push(v);
  });
  params.push(offer_id);

  const { rows } = await pool.query(
    `UPDATE offers SET ${sets.join(', ')}, updated_at = NOW()
     WHERE offer_id = $${params.length}
     RETURNING *`,
    params
  );
  return mapOffer(rows[0]);
}

async function deleteOffer(offer_id) {
  const { rowCount } = await pool.query(`DELETE FROM offers WHERE offer_id = $1`, [offer_id]);
  return rowCount > 0;
}

module.exports = {
  createOffer,
  getOfferById,
  listOffers,
  updateOffer,
  deleteOffer,
};