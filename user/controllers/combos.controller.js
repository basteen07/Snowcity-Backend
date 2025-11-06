const comboService = require('../../services/comboService');

// GET /api/combos
exports.listCombos = async (req, res, next) => {
  try {
    const active = req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const data = await comboService.list({ active });
    res.json({ data, meta: { count: data.length } });
  } catch (err) {
    next(err);
  }
};

// GET /api/combos/:id
exports.getComboById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await comboService.getById(id);
    res.json(row);
  } catch (err) {
    next(err);
  }
};