const attractionService = require('../../services/attractionService');

// GET /api/attractions
exports.listAttractions = async (req, res, next) => {
  try {
    const search = (req.query.search || '').toString().trim();
    const active = req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;
    const booking_date = req.query.booking_date || null;
    const booking_time = req.query.booking_time || null;

    const data = await attractionService.list({ search, active, limit, offset, booking_date, booking_time });
    res.json({ data, meta: { page, limit, count: data.length } });
  } catch (err) {
    next(err);
  }
};

// GET /api/attractions/:id
exports.getAttractionById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const booking_date = req.query.booking_date || null;
    const booking_time = req.query.booking_time || null;
    const row = await attractionService.getById(id, { booking_date, booking_time });
    res.json(row);
  } catch (err) {
    next(err);
  }
};