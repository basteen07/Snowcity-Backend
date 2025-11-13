const comboSlotService = require('../../services/comboSlotService');

// GET /api/combo-slots
exports.listSlots = async (req, res, next) => {
  try {
    const combo_id = req.query.combo_id ? Number(req.query.combo_id) : null;
    const date = req.query.date || null;
    const start_date = req.query.start_date || null;
    const end_date = req.query.end_date || null;
    const data = await comboSlotService.list({ combo_id, date, start_date, end_date });
    res.json({ data, meta: { count: data.length } });
  } catch (err) {
    next(err);
  }
};

// GET /api/combo-slots/:id
exports.getSlotById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await comboSlotService.getById(id);
    res.json(row);
  } catch (err) {
    next(err);
  }
};
