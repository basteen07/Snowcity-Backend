const pagesModel = require('../models/cmsPages.model');

async function list({ active = true, q = '', limit = 50, offset = 0 } = {}) {
  return pagesModel.listPages({ active, q, limit, offset });
}

async function getById(id) {
  const row = await pagesModel.getPageById(id);
  if (!row) {
    const err = new Error('Page not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function getBySlug(slug) {
  const row = await pagesModel.getPageBySlug(slug);
  if (!row) {
    const err = new Error('Page not found');
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