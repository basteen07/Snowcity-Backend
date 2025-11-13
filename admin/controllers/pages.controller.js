// admin/controllers/pages.controller.js
const pagesModel = require('../../models/cmsPages.model');
const { pool } = require('../../config/db');

// List pages (filters + pagination)
exports.listPages = async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const active =
      req.query.active === undefined
        ? null
        : String(req.query.active).toLowerCase() === 'true'
          ? true
          : String(req.query.active).toLowerCase() === 'false'
            ? false
            : null;

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    let i = 1;

    if (active !== null) {
      where.push(`p.active = $${i++}`);
      params.push(active);
    }
    if (q) {
      where.push(`(p.title ILIKE $${i} OR p.slug ILIKE $${i})`);
      params.push(`%${q}%`);
      i += 1;
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT
        p.page_id, p.title, p.slug, p.active,
        p.nav_group, p.nav_order,
        p.placement, p.placement_ref_id,
        p.created_at, p.updated_at
      FROM cms_pages p
      ${whereSql}
      ORDER BY p.created_at DESC
      LIMIT $${i} OFFSET $${i + 1}
    `;
    const cntSql = `
      SELECT COUNT(*)::int AS count
      FROM cms_pages p
      ${whereSql}
    `;

    const [rowsRes, cntRes] = await Promise.all([
      pool.query(sql, [...params, limit, offset]),
      pool.query(cntSql, params),
    ]);

    res.json({ data: rowsRes.rows, meta: { page, limit, total: cntRes.rows[0]?.count || 0 } });
  } catch (err) { next(err); }
};

// Get single page by id
exports.getPageById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await pagesModel.getPageById(id);
    if (!row) return res.status(404).json({ error: 'Page not found' });
    res.json(row);
  } catch (err) { next(err); }
};

// Create page
exports.createPage = async (req, res, next) => {
  try {
    const p = req.body || {};
    const payload = {
      title: p.title || '',
      slug: p.slug || '',
      content: p.content || '',
      active: p.active !== undefined ? !!p.active : true,

      // SEO/meta
      meta_title: p.meta_title || null,
      meta_description: p.meta_description || null,
      meta_keywords: p.meta_keywords || null,

      // Linking/section
      section_type: p.section_type || 'none',
      section_ref_id: p.section_ref_id || null,

      // Gallery
      gallery: Array.isArray(p.gallery) ? p.gallery : [],

      // Editor mode
      editor_mode: p.editor_mode || 'rich',
      raw_html: p.raw_html || null,
      raw_css: p.raw_css || null,
      raw_js: p.raw_js || null,

      // Nav + placement
      nav_group: p.nav_group || null,                 // e.g., 'visitors_guide'
      nav_order: Number.isFinite(p.nav_order) ? Number(p.nav_order) : 0,
      placement: p.placement || 'none',               // 'none'|'home_bottom'|'attraction_details'
      placement_ref_id: p.placement_ref_id || null,   // attraction id if placement is attraction_details
    };

    const row = await pagesModel.createPage(payload);
    res.status(201).json(row);
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Duplicate slug' });
    }
    next(err);
  }
};

// Update page
exports.updatePage = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const p = req.body || {};
    const payload = {
      title: p.title,
      slug: p.slug,
      content: p.content,
      active: p.active,
      meta_title: p.meta_title,
      meta_description: p.meta_description,
      meta_keywords: p.meta_keywords,
      section_type: p.section_type,
      section_ref_id: p.section_ref_id,
      gallery: Array.isArray(p.gallery) ? p.gallery : undefined,
      editor_mode: p.editor_mode,
      raw_html: p.raw_html,
      raw_css: p.raw_css,
      raw_js: p.raw_js,
      nav_group: p.nav_group,
      nav_order: Number.isFinite(p.nav_order) ? Number(p.nav_order) : undefined,
      placement: p.placement,
      placement_ref_id: p.placement_ref_id,
    };
    const row = await pagesModel.updatePage(id, payload);
    if (!row) return res.status(404).json({ error: 'Page not found' });
    res.json(row);
  } catch (err) { next(err); }
};

// Delete page
exports.deletePage = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ok = await pagesModel.deletePage(id);
    if (!ok) return res.status(404).json({ error: 'Page not found' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
};

// Preview (no save)
exports.previewPage = async (req, res, next) => {
  try {
    const p = req.body || {};
    const out = {
      title: p.title || '',
      slug: p.slug || '',
      content: p.content || '',
      meta_title: p.meta_title || null,
      meta_description: p.meta_description || null,
      meta_keywords: p.meta_keywords || null,
      section_type: p.section_type || 'none',
      section_ref_id: p.section_ref_id || null,
      gallery: Array.isArray(p.gallery) ? p.gallery : [],
      active: p.active !== undefined ? !!p.active : true,
      editor_mode: p.editor_mode || 'rich',
      raw_html: p.raw_html || '',
      raw_css: p.raw_css || '',
      raw_js: p.raw_js || '',
      preview: true,
    };
    res.json(out);
  } catch (err) { next(err); }
};

// Nav listing (for Visitors Guide)
exports.listNav = async (req, res, next) => {
  try {
    const group = String(req.query.group || '').toLowerCase().trim();
    if (!group) return res.status(400).json({ error: 'group is required' });
    const { rows } = await pool.query(
      `SELECT page_id, title, slug, nav_order
       FROM cms_pages
       WHERE active = TRUE AND LOWER(nav_group) = LOWER($1)
       ORDER BY nav_order ASC, LOWER(title) ASC`,
      [group]
    );
    res.json(rows);
  } catch (err) { next(err); }
};