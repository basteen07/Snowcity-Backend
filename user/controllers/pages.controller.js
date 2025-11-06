const pageService = require('../../services/pageService');

// GET /api/pages
exports.listPages = async (req, res, next) => {
  try {
    const active = req.query.active === undefined ? true : String(req.query.active).toLowerCase() === 'true';
    const q = (req.query.q || '').toString().trim();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const data = await pageService.list({ active, q, limit, offset });
    res.json({ data, meta: { page, limit, count: data.length } });
  } catch (err) {
    next(err);
  }
};

// GET /api/pages/:id
exports.getPageById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await pageService.getById(id);
    res.json(row);
  } catch (err) {
    next(err);
  }
};

// GET /api/pages/slug/:slug
exports.getPageBySlug = async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const row = await pageService.getBySlug(slug);
    res.json(row);
  } catch (err) {
    next(err);
  }
};