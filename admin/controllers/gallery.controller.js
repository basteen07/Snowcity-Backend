const galleryModel = require('../../models/gallery.model');

exports.list = async (req, res, next) => {
  try {
    const active = req.query.active === undefined ? null : String(req.query.active).toLowerCase() === 'true';
    const q = (req.query.q || '').toString().trim();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;
    const target_type = (req.query.target_type || '').toString().trim() || null;
    const target_ref_id = req.query.target_ref_id !== undefined && req.query.target_ref_id !== ''
      ? Number(req.query.target_ref_id)
      : null;

    const data = await galleryModel.list({ active, q, target_type, target_ref_id, limit, offset });
    res.json({ data, meta: { page, limit, count: data.length } });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid gallery id' });
    const row = await galleryModel.getById(id);
    if (!row) return res.status(404).json({ error: 'Gallery item not found' });
    res.json(row);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const {
      media_type,
      url,
      title = null,
      description = null,
      active = true,
      target_type = 'none',
      target_ref_id = null,
    } = req.body || {};
    if (!media_type || !url) return res.status(400).json({ error: 'media_type and url are required' });
    const row = await galleryModel.create({ media_type, url, title, description, active, target_type, target_ref_id });
    res.status(201).json(row);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid gallery id' });
    const row = await galleryModel.update(id, req.body || {});
    if (!row) return res.status(404).json({ error: 'Gallery item not found' });
    res.json(row);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid gallery id' });
    const ok = await galleryModel.remove(id);
    if (!ok) return res.status(404).json({ error: 'Gallery item not found' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
};
