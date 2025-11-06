const { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } = require('./constants');

function parse(query = {}) {
  const page = Math.max(parseInt(query.page || DEFAULT_PAGE, 10) || DEFAULT_PAGE, 1);
  let limit = parseInt(query.limit || DEFAULT_LIMIT, 10) || DEFAULT_LIMIT;
  limit = Math.min(Math.max(limit, 1), MAX_LIMIT);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function meta({ page, limit, total }) {
  const pages = Math.max(1, Math.ceil((total || 0) / (limit || DEFAULT_LIMIT)));
  return { page, limit, total, pages };
}

module.exports = {
  parse,
  meta,
};