const galleryModel = require('../../models/gallery.model');

exports.list = async (req, res, next) => {
  try {
    const active = req.query.active === undefined ? true : String(req.query.active).toLowerCase() === 'true';
    const limit = Math.min(Math.max(parseInt(req.query.limit || '12', 10), 1), 50);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const offset = (page - 1) * limit;
    const q = (req.query.q || '').toString().trim();
    const target_type = (req.query.target_type || '').toString().trim() || null;
    const target_ref_id = req.query.target_ref_id !== undefined && req.query.target_ref_id !== ''
      ? Number(req.query.target_ref_id)
      : null;

    if (target_ref_id != null && !Number.isFinite(target_ref_id)) {
      return res.status(400).json({ error: 'Invalid target_ref_id' });
    }

    const data = await galleryModel.list({ active, q, target_type, target_ref_id, limit, offset });
    res.json({ data, meta: { page, limit, count: data.length } });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await galleryModel.getById(id);
    if (!row) return res.status(404).json({ error: 'Gallery item not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};
