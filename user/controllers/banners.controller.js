const bannerService = require('../../services/bannerService');

// GET /api/banners
exports.listBanners = async (req, res, next) => {
  try {
    const active = req.query.active === undefined ? true : String(req.query.active).toLowerCase() === 'true';
    const attraction_id = req.query.attraction_id ? Number(req.query.attraction_id) : null;
    const offer_id = req.query.offer_id ? Number(req.query.offer_id) : null;
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const data = await bannerService.list({ active, attraction_id, offer_id, limit, offset });
    res.json({ data, meta: { page, limit, count: data.length } });
  } catch (err) {
    next(err);
  }
};

// GET /api/banners/:id
exports.getBannerById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await bannerService.getById(id);
    res.json(row);
  } catch (err) {
    next(err);
  }
};