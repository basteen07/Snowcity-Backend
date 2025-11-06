const { pool } = require('../config/db');

function mapBlog(row) {
  if (!row) return null;
  return {
    blog_id: row.blog_id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    image_url: row.image_url,
    author: row.author,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createBlog({ title, slug, content = null, image_url = null, author = null, active = true }) {
  const { rows } = await pool.query(
    `INSERT INTO blogs (title, slug, content, image_url, author, active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [title, slug, content, image_url, author, active]
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