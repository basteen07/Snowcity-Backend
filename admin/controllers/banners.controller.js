const bannersModel = require('../../models/banners.model');

exports.listBanners = async (req, res, next) => {
  try {
    const active =
      req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const attraction_id = req.query.attraction_id ? Number(req.query.attraction_id) : null;
    const offer_id = req.query.offer_id ? Number(req.query.offer_id) : null;

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const data = await bannersModel.listBanners({ active, attraction_id, offer_id, limit, offset });
    res.json({ data, meta: { page, limit, count: data.length } });
  } catch (err) {
    next(err);
  }
};

exports.getBannerById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await bannersModel.getBannerById(id);
    if (!row) return res.status(404).json({ error: 'Banner not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.createBanner = async (req, res, next) => {
  try {
    const row = await bannersModel.createBanner(req.body || {});
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

exports.updateBanner = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await bannersModel.updateBanner(id, req.body || {});
    if (!row) return res.status(404).json({ error: 'Banner not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.deleteBanner = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ok = await bannersModel.deleteBanner(id);
    if (!ok) return res.status(404).json({ error: 'Banner not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};