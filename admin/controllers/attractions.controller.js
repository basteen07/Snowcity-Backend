const attractionsModel = require('../../models/attractions.model');

exports.listAttractions = async (req, res, next) => {
  try {
    const search = (req.query.search || '').toString().trim();
    const active = req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const data = await attractionsModel.listAttractions({ search, active, limit, offset });
    res.json({ data, meta: { page, limit, count: data.length } });
  } catch (err) {
    next(err);
  }
};

exports.getAttractionById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await attractionsModel.getAttractionById(id);
    if (!row) return res.status(404).json({ error: 'Attraction not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.createAttraction = async (req, res, next) => {
  try {
    const row = await attractionsModel.createAttraction(req.body || {});
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

exports.updateAttraction = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await attractionsModel.updateAttraction(id, req.body || {});
    if (!row) return res.status(404).json({ error: 'Attraction not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.deleteAttraction = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ok = await attractionsModel.deleteAttraction(id);
    if (!ok) return res.status(404).json({ error: 'Attraction not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};