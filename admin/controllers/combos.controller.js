const combosModel = require('../../models/combos.model');

exports.listCombos = async (req, res, next) => {
  try {
    const active = req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const data = await combosModel.listCombos({ active });
    res.json({ data, meta: { count: data.length } });
  } catch (err) {
    next(err);
  }
};

exports.getComboById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await combosModel.getComboById(id);
    if (!row) return res.status(404).json({ error: 'Combo not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.createCombo = async (req, res, next) => {
  try {
    const row = await combosModel.createCombo(req.body || {});
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

exports.updateCombo = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await combosModel.updateCombo(id, req.body || {});
    if (!row) return res.status(404).json({ error: 'Combo not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.deleteCombo = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ok = await combosModel.deleteCombo(id);
    if (!ok) return res.status(404).json({ error: 'Combo not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};