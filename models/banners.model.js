const { pool } = require('../config/db');

function mapBanner(row) {
  if (!row) return null;
  return {
    banner_id: row.banner_id,
    web_image: row.web_image,
    mobile_image: row.mobile_image,
    title: row.title,
    description: row.description,
    linked_attraction_id: row.linked_attraction_id,
    linked_offer_id: row.linked_offer_id,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createBanner({
  web_image = null,
  mobile_image = null,
  title = null,
  description = null,
  linked_attraction_id = null,
  linked_offer_id = null,
  active = true,
}) {
  const { rows } = await pool.query(
    `INSERT INTO banners (web_image, mobile_image, title, description, linked_attraction_id, linked_offer_id, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [web_image, mobile_image, title, description, linked_attraction_id, linked_offer_id, active]
  );
  return mapBanner(rows[0]);
}

async function getBannerById(banner_id) {
  const { rows } = await pool.query(`SELECT * FROM banners WHERE banner_id = $1`, [banner_id]);
  return mapBanner(rows[0]);
}

async function listBanners({ active = null, attraction_id = null, offer_id = null, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (active != null) {
    where.push(`b.active = $${i++}`);
    params.push(Boolean(active));
  }
  if (attraction_id) {
    where.push(`b.linked_attraction_id = $${i++}`);
    params.push(Number(attraction_id));
  }
  if (offer_id) {
    where.push(`b.linked_offer_id = $${i++}`);
    params.push(Number(offer_id));
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT b.* FROM banners b
     ${whereSql}
     ORDER BY b.created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );
  return rows.map(mapBanner);
}

async function updateBanner(banner_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getBannerById(banner_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    sets.push(`${k} = $${idx + 1}`);
    params.push(v);
  });
  params.push(banner_id);

  const { rows } = await pool.query(
    `UPDATE banners SET ${sets.join(', ')}, updated_at = NOW()
     WHERE banner_id = $${params.length}
     RETURNING *`,
    params
  );
  return mapBanner(rows[0]);
}

async function deleteBanner(banner_id) {
  const { rowCount } = await pool.query(`DELETE FROM banners WHERE banner_id = $1`, [banner_id]);
  return rowCount > 0;
}

module.exports = {
  createBanner,
  getBannerById,
  listBanners,
  updateBanner,
  deleteBanner,
};