const blogsModel = require('../models/blogs.model');

async function list({ active = true, q = '', limit = 50, offset = 0 } = {}) {
  return blogsModel.listBlogs({ active, q, limit, offset });
}

async function getById(id) {
  const row = await blogsModel.getBlogById(id);
  if (!row) {
    const err = new Error('Blog not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function getBySlug(slug) {
  const row = await blogsModel.getBlogBySlug(slug);
  if (!row) {
    const err = new Error('Blog not found');
    err.status = 404;
    throw err;
  }
  return row;
}

module.exports = {
  list,
  getById,
  getBySlug,
};