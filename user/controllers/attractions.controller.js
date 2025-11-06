const attractionService = require('../../services/attractionService');

// GET /api/attractions
exports.listAttractions = async (req, res, next) => {
  try {
    const search = (req.query.search || '').toString().trim();
    const active = req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const data = await attractionService.list({ search, active, limit, offset });
    res.json({ data, meta: { page, limit, count: data.length } });
  } catch (err) {
    next(err);
  }
};

// GET /api/attractions/:id
exports.getAttractionById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await attractionService.getById(id);
    res.json(row);
  } catch (err) {
    next(err);
  }
};