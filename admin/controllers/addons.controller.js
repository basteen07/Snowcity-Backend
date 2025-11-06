const addonsModel = require('../../models/addons.model');

exports.listAddons = async (req, res, next) => {
  try {
    const active = req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const data = await addonsModel.listAddons({ active });
    res.json({ data, meta: { count: data.length } });
  } catch (err) {
    next(err);
  }
};

exports.getAddonById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await addonsModel.getAddonById(id);
    if (!row) return res.status(404).json({ error: 'Addon not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.createAddon = async (req, res, next) => {
  try {
    const row = await addonsModel.createAddon(req.body || {});
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

exports.updateAddon = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await addonsModel.updateAddon(id, req.body || {});
    if (!row) return res.status(404).json({ error: 'Addon not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.deleteAddon = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ok = await addonsModel.deleteAddon(id);
    if (!ok) return res.status(404).json({ error: 'Addon not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};