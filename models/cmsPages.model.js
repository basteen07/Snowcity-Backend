const { pool } = require('../config/db');

function mapPage(row) {
  if (!row) return null;
  return {
    page_id: row.page_id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    image_url: row.image_url || row.hero_image || null,
    meta_title: row.meta_title,
    meta_description: row.meta_description,
    meta_keywords: row.meta_keywords,
    section_type: row.section_type,
    section_ref_id: row.section_ref_id,
    gallery: row.gallery,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createPage({ title, slug, content, image_url = null, hero_image = null, meta_title = null, meta_description = null, meta_keywords = null, section_type = 'none', section_ref_id = null, gallery = [], active = true }) {
  const hero = hero_image || image_url || null;
  try {
    const { rows } = await pool.query(
      `INSERT INTO cms_pages (title, slug, content, hero_image, meta_title, meta_description, meta_keywords, section_type, section_ref_id, gallery, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, '[]'::jsonb), $11)
       RETURNING *`,
      [title, slug, content, hero, meta_title, meta_description, meta_keywords, section_type, section_ref_id, Array.isArray(gallery) ? JSON.stringify(gallery) : gallery, active]
    );
    return mapPage(rows[0]);
  } catch (err) {
    // Fallback for schemas without hero_image column
    if (err && (err.code === '42703' || /column\s+"?hero_image"?\s+does not exist/i.test(String(err.message)))) {
      const { rows } = await pool.query(
        `INSERT INTO cms_pages (title, slug, content, meta_title, meta_description, meta_keywords, section_type, section_ref_id, gallery, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, '[]'::jsonb), $10)
         RETURNING *`,
        [title, slug, content, meta_title, meta_description, meta_keywords, section_type, section_ref_id, Array.isArray(gallery) ? JSON.stringify(gallery) : gallery, active]
      );
      return mapPage(rows[0]);
    }
    throw err;
  }
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
  const input = { ...fields };
  // Normalize hero image: accept image_url from API but store in hero_image
  if (Object.prototype.hasOwnProperty.call(input, 'image_url')) {
    if (!Object.prototype.hasOwnProperty.call(input, 'hero_image')) {
      input.hero_image = input.image_url;
    }
    delete input.image_url;
  }

  // Whitelist allowed columns to avoid "column does not exist" errors
  const allowed = new Set([
    'title', 'slug', 'content', 'meta_title', 'meta_description', 'meta_keywords',
    'section_type', 'section_ref_id', 'gallery', 'active', 'hero_image'
  ]);

  const entries = Object.entries(input).filter(([k, v]) => allowed.has(k) && v !== undefined);
  if (!entries.length) return getPageById(page_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v]) => {
    let val = v;
    if (k === 'gallery' && Array.isArray(val)) {
      val = JSON.stringify(val);
    }
    sets.push(`${k} = $${params.length + 1}`);
    params.push(val);
  });
  params.push(page_id);

  try {
    const { rows } = await pool.query(
      `UPDATE cms_pages SET ${sets.join(', ')}, updated_at = NOW()
       WHERE page_id = $${params.length}
       RETURNING *`,
      params
    );
    return mapPage(rows[0]);
  } catch (err) {
    // Fallback if hero_image column does not exist in current schema
    if (err && (err.code === '42703' || /column\s+"?hero_image"?\s+does not exist/i.test(String(err.message)))) {
      const noHeroEntries = entries.filter(([k]) => k !== 'hero_image');
      if (!noHeroEntries.length) return getPageById(page_id);
      const sets2 = [];
      const params2 = [];
      noHeroEntries.forEach(([k, v]) => {
        let val = v;
        if (k === 'gallery' && Array.isArray(val)) val = JSON.stringify(val);
        sets2.push(`${k} = $${params2.length + 1}`);
        params2.push(val);
      });
      params2.push(page_id);
      const { rows } = await pool.query(
        `UPDATE cms_pages SET ${sets2.join(', ')}, updated_at = NOW()
         WHERE page_id = $${params2.length}
         RETURNING *`,
        params2
      );
      return mapPage(rows[0]);
    }
    throw err;
  }
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