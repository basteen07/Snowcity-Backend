const offerService = require('../../services/offerService');

// GET /api/offers
exports.listOffers = async (req, res, next) => {
  try {
    const active = req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const rule_type = req.query.rule_type || null;
    const date = req.query.date || null;
    const q = (req.query.q || '').toString().trim();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const data = await offerService.list({ active, rule_type, date, q, limit, offset });
    res.json({ data, meta: { page, limit, count: data.length } });
  } catch (err) {
    next(err);
  }
};

// GET /api/offers/:id
exports.getOfferById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await offerService.getById(id);
    res.json(row);
  } catch (err) {
    next(err);
  }
};