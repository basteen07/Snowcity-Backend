const offersModel = require('../../models/offers.model');

exports.listOffers = async (req, res, next) => {
  try {
    const active = req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const rule_type = req.query.rule_type || null;
    const date = req.query.date || null;
    const q = (req.query.q || '').toString().trim();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const data = await offersModel.listOffers({ active, rule_type, date, q, limit, offset });
    res.json({ data, meta: { page, limit, count: data.length } });
  } catch (err) {
    next(err);
  }
};

exports.getOfferById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await offersModel.getOfferById(id);
    if (!row) return res.status(404).json({ error: 'Offer not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.createOffer = async (req, res, next) => {
  try {
    const row = await offersModel.createOffer(req.body || {});
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

exports.updateOffer = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await offersModel.updateOffer(id, req.body || {});
    if (!row) return res.status(404).json({ error: 'Offer not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.deleteOffer = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ok = await offersModel.deleteOffer(id);
    if (!ok) return res.status(404).json({ error: 'Offer not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};