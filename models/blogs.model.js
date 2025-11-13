const { pool } = require('../config/db');

function mapBlog(row) {
  if (!row) return null;
  return {
    blog_id: row.blog_id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    editor_mode: row.editor_mode,
    raw_html: row.raw_html,
    raw_css: row.raw_css,
    raw_js: row.raw_js,
    image_url: row.image_url,
    author: row.author,
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

async function createBlog({ title, slug, content = null, image_url = null, author = null, meta_title = null, meta_description = null, meta_keywords = null, section_type = 'none', section_ref_id = null, gallery = [], active = true }) {
  const { rows } = await pool.query(
    `INSERT INTO blogs (title, slug, content, image_url, author, meta_title, meta_description, meta_keywords, section_type, section_ref_id, gallery, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, '[]'::jsonb), $12)
     RETURNING *`,
    [title, slug, content, image_url, author, meta_title, meta_description, meta_keywords, section_type, section_ref_id, Array.isArray(gallery) ? JSON.stringify(gallery) : gallery, active]
  );
  return mapBlog(rows[0]);
}

async function getBlogById(blog_id) {
  const { rows } = await pool.query(`SELECT * FROM blogs WHERE blog_id = $1`, [blog_id]);
  return mapBlog(rows[0]);
}

async function getBlogBySlug(slug) {
  const { rows } = await pool.query(`SELECT * FROM blogs WHERE slug = $1`, [slug]);
  return mapBlog(rows[0]);
}

async function listBlogs({ active = null, q = '', limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (active != null) {
    where.push(`active = $${i++}`);
    params.push(Boolean(active));
  }
  if (q) {
    where.push(`(title ILIKE $${i} OR slug ILIKE $${i} OR author ILIKE $${i})`);
    params.push(`%${q}%`);
    i += 1;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM blogs
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );
  return rows.map(mapBlog);
}

async function updateBlog(blog_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getBlogById(blog_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    sets.push(`${k} = $${idx + 1}`);
    params.push(v);
  });
  params.push(blog_id);

  const { rows } = await pool.query(
    `UPDATE blogs SET ${sets.join(', ')}, updated_at = NOW()
     WHERE blog_id = $${params.length}
     RETURNING *`,
    params
  );
  return mapBlog(rows[0]);
}

async function deleteBlog(blog_id) {
  const { rowCount } = await pool.query(`DELETE FROM blogs WHERE blog_id = $1`, [blog_id]);
  return rowCount > 0;
}

module.exports = {
  createBlog,
  getBlogById,
  getBlogBySlug,
  listBlogs,
  updateBlog,
  deleteBlog,
};