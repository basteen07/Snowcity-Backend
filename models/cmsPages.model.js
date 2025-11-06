const { pool } = require('../config/db');

function mapPage(row) {
  if (!row) return null;
  return {
    page_id: row.page_id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createPage({ title, slug, content, active = true }) {
  const { rows } = await pool.query(
    `INSERT INTO cms_pages (title, slug, content, active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [title, slug, content, active]
  );
  return mapPage(rows[0]);
}

async function getPageById(page_id) {
  const { rows } = await pool.query(`SELECT * FROM cms_pages WHERE page_id = $1`, [page_id]);
  return mapPage(rows[0]);
}

async function getPageBySlug(slug) {
  const { rows } = await pool.query(`SELECT * FROM cms_pages WHERE slug = $1`, [slug]);
  return mapPage(rows[0]);
}

async function listPages({ active = null, q = '', limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (active != null) {
    where.push(`active = $${i++}`);
    params.push(Boolean(active));
  }
  if (q) {
    where.push(`(title ILIKE $${i} OR slug ILIKE $${i})`);
    params.push(`%${q}%`);
    i += 1;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM cms_pages
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );
  return rows.map(mapPage);
}

async function updatePage(page_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getPageById(page_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    sets.push(`${k} = $${idx + 1}`);
    params.push(v);
  });
  params.push(page_id);

  const { rows } = await pool.query(
    `UPDATE cms_pages SET ${sets.join(', ')}, updated_at = NOW()
     WHERE page_id = $${params.length}
     RETURNING *`,
    params
  );
  return mapPage(rows[0]);
}

async function deletePage(page_id) {
  const { rowCount } = await pool.query(`DELETE FROM cms_pages WHERE page_id = $1`, [page_id]);
  return rowCount > 0;
}

module.exports = {
  createPage,
  getPageById,
  getPageBySlug,
  listPages,
  updatePage,
  deletePage,
};