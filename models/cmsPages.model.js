const { pool } = require('../config/db');

function normalizeGallery(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

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
    gallery: normalizeGallery(row.gallery),
    editor_mode: row.editor_mode || 'rich',
    raw_html: row.raw_html || null,
    raw_css: row.raw_css || null,
    raw_js: row.raw_js || null,
    nav_group: row.nav_group || null,
    nav_order: Number.isFinite(row.nav_order) ? Number(row.nav_order) : 0,
    placement: row.placement || 'none',
    placement_ref_id: row.placement_ref_id,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createPage({
  title,
  slug,
  content,
  image_url = null,
  hero_image = null,
  meta_title = null,
  meta_description = null,
  meta_keywords = null,
  section_type = 'none',
  section_ref_id = null,
  gallery = [],
  active = true,
  editor_mode = 'rich',
  raw_html = null,
  raw_css = null,
  raw_js = null,
  nav_group = null,
  nav_order = 0,
  placement = 'none',
  placement_ref_id = null,
}) {
  const hero = hero_image || image_url || null;
  const galleryPayload = Array.isArray(gallery) ? JSON.stringify(gallery) : gallery;
  const navOrder = Number.isFinite(Number(nav_order)) ? Number(nav_order) : 0;
  try {
    const { rows } = await pool.query(
      `INSERT INTO cms_pages (
        title, slug, content, hero_image,
        meta_title, meta_description, meta_keywords,
        section_type, section_ref_id, gallery, active,
        nav_group, nav_order, placement, placement_ref_id,
        editor_mode, raw_html, raw_css, raw_js
      )
       VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, COALESCE($10, '[]'::jsonb), $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19
      )
       RETURNING *`,
      [
        title,
        slug,
        content,
        hero,
        meta_title,
        meta_description,
        meta_keywords,
        section_type,
        section_ref_id,
        galleryPayload,
        active,
        nav_group,
        navOrder,
        placement,
        placement_ref_id,
        editor_mode,
        raw_html,
        raw_css,
        raw_js,
      ]
    );
    return mapPage(rows[0]);
  } catch (err) {
    const missingColumn = err && (err.code === '42703' || /column\s+"?(hero_image|nav_group|nav_order|placement|placement_ref_id|editor_mode|raw_html|raw_css|raw_js)"?\s+does not exist/i.test(String(err.message)));
    if (missingColumn) {
      const { rows } = await pool.query(
        `INSERT INTO cms_pages (
          title, slug, content,
          meta_title, meta_description, meta_keywords,
          section_type, section_ref_id, gallery, active
        )
         VALUES (
          $1, $2, $3,
          $4, $5, $6,
          $7, $8, COALESCE($9, '[]'::jsonb), $10
        )
         RETURNING *`,
        [title, slug, content, meta_title, meta_description, meta_keywords, section_type, section_ref_id, galleryPayload, active]
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

  if (Object.prototype.hasOwnProperty.call(input, 'nav_order')) {
    const navOrder = Number.isFinite(Number(input.nav_order)) ? Number(input.nav_order) : 0;
    input.nav_order = navOrder;
  }

  // Whitelist allowed columns to avoid "column does not exist" errors
  const allowed = new Set([
    'title', 'slug', 'content', 'meta_title', 'meta_description', 'meta_keywords',
    'section_type', 'section_ref_id', 'gallery', 'active', 'hero_image',
    'nav_group', 'nav_order', 'placement', 'placement_ref_id',
    'editor_mode', 'raw_html', 'raw_css', 'raw_js'
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
    // Fallback if extended columns do not exist in current schema
    if (err && (err.code === '42703' || /column\s+"?(hero_image|nav_group|nav_order|placement|placement_ref_id|editor_mode|raw_html|raw_css|raw_js)"?\s+does not exist/i.test(String(err.message)))) {
      const noExtendedEntries = entries.filter(([k]) => !['hero_image', 'nav_group', 'nav_order', 'placement', 'placement_ref_id', 'editor_mode', 'raw_html', 'raw_css', 'raw_js'].includes(k));
      if (!noExtendedEntries.length) return getPageById(page_id);
      const sets2 = [];
      const params2 = [];
      noExtendedEntries.forEach(([k, v]) => {
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