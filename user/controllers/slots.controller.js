const slotService = require('../../services/slotService');

// GET /api/slots
exports.listSlots = async (req, res, next) => {
  try {
    const attraction_id = req.query.attraction_id ? Number(req.query.attraction_id) : null;
    const date = req.query.date || null;
    const start_date = req.query.start_date || null;
    const end_date = req.query.end_date || null;
    const data = await slotService.list({ attraction_id, date, start_date, end_date });
    res.json({ data, meta: { count: data.length } });
  } catch (err) {
    next(err);
  }
};

// GET /api/slots/:id
exports.getSlotById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await slotService.getById(id);
    res.json(row);
  } catch (err) {
    next(err);
  }
};