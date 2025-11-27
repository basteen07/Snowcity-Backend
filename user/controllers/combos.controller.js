const comboService = require('../../services/comboService');

// GET /api/combos
exports.listCombos = async (req, res, next) => {
  try {
    const active = req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const booking_date = req.query.booking_date || null;
    const booking_time = req.query.booking_time || null;
    const data = await comboService.list({ active, booking_date, booking_time });
    res.json({ data, meta: { count: data.length } });
  } catch (err) {
    next(err);
  }
};

// GET /api/combos/:id
exports.getComboById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const booking_date = req.query.booking_date || null;
    const booking_time = req.query.booking_time || null;
    const row = await comboService.getById(id, { booking_date, booking_time });
    res.json(row);
  } catch (err) {
    next(err);
  }
};