const blogsModel = require('../../models/blogs.model');

exports.listBlogs = async (req, res, next) => {
  try {
    const active =
      req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const q = (req.query.q || '').toString().trim();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const data = await blogsModel.listBlogs({ active, q, limit, offset });
    res.json({ data, meta: { page, limit, count: data.length } });
  } catch (err) {
    next(err);
  }
};

exports.getBlogById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await blogsModel.getBlogById(id);
    if (!row) return res.status(404).json({ error: 'Blog not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.createBlog = async (req, res, next) => {
  try {
    const row = await blogsModel.createBlog(req.body || {});
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

exports.updateBlog = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await blogsModel.updateBlog(id, req.body || {});
    if (!row) return res.status(404).json({ error: 'Blog not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.deleteBlog = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ok = await blogsModel.deleteBlog(id);
    if (!ok) return res.status(404).json({ error: 'Blog not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};