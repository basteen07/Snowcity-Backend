const pagesModel = require('../../models/cmsPages.model');

exports.listPages = async (req, res, next) => {
  try {
    const active =
      req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const q = (req.query.q || '').toString().trim();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const data = await pagesModel.listPages({ active, q, limit, offset });
    res.json({ data, meta: { page, limit, count: data.length } });
  } catch (err) {
    next(err);
  }
};

exports.getPageById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await pagesModel.getPageById(id);
    if (!row) return res.status(404).json({ error: 'Page not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.createPage = async (req, res, next) => {
  try {
    const row = await pagesModel.createPage(req.body || {});
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

exports.updatePage = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await pagesModel.updatePage(id, req.body || {});
    if (!row) return res.status(404).json({ error: 'Page not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.deletePage = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ok = await pagesModel.deletePage(id);
    if (!ok) return res.status(404).json({ error: 'Page not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};