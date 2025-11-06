const slotsModel = require('../../models/attractionSlots.model');

exports.listSlots = async (req, res, next) => {
  try {
    const attraction_id = req.query.attraction_id ? Number(req.query.attraction_id) : null;
    const date = req.query.date || null;
    const start_date = req.query.start_date || null;
    const end_date = req.query.end_date || null;

    const data = await slotsModel.listSlots({ attraction_id, date, start_date, end_date });
    res.json({ data, meta: { count: data.length } });
  } catch (err) {
    next(err);
  }
};

exports.getSlotById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await slotsModel.getSlotById(id);
    if (!row) return res.status(404).json({ error: 'Slot not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.createSlot = async (req, res, next) => {
  try {
    const payload = req.body || {};
    // prevent overlaps
    const overlap = await slotsModel.slotOverlapExists(payload);
    if (overlap) return res.status(409).json({ error: 'Overlapping slot exists for this attraction/date/time window' });

    const row = await slotsModel.createSlot(payload);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

exports.updateSlot = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = req.body || {};

    if (payload.attraction_id || payload.start_date || payload.end_date || payload.start_time || payload.end_time) {
      const current = await slotsModel.getSlotById(id);
      if (!current) return res.status(404).json({ error: 'Slot not found' });

      const overlap = await slotsModel.slotOverlapExists({
        attraction_id: payload.attraction_id ?? current.attraction_id,
        start_date: payload.start_date ?? current.start_date,
        end_date: payload.end_date ?? current.end_date,
        start_time: payload.start_time ?? current.start_time,
        end_time: payload.end_time ?? current.end_time,
        exclude_slot_id: id,
      });
      if (overlap) return res.status(409).json({ error: 'Overlapping slot exists for this attraction/date/time window' });
    }

    const row = await slotsModel.updateSlot(id, payload);
    if (!row) return res.status(404).json({ error: 'Slot not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.deleteSlot = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ok = await slotsModel.deleteSlot(id);
    if (!ok) return res.status(404).json({ error: 'Slot not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};