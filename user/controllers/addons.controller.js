const addonService = require('../../services/addonService');

// GET /api/addons
exports.listAddons = async (req, res, next) => {
  try {
    const active = req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const data = await addonService.list({ active });
    res.json({ data, meta: { count: data.length } });
  } catch (err) {
    next(err);
  }
};

// GET /api/addons/:id
exports.getAddonById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await addonService.getById(id);
    res.json(row);
  } catch (err) {
    next(err);
  }
};