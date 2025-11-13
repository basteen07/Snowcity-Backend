const comboSlotService = require('../../services/comboSlotService');

function normalizeDateFields(payload) {
  const out = { ...(payload || {}) };
  const date = out.date || out.day || null;
  if (date && !out.start_date && !out.end_date) {
    out.start_date = date;
    out.end_date = date;
  }
  if (out.start_date && !out.end_date) out.end_date = out.start_date;
  return out;
}

function to24h(timeStr) {
  if (!timeStr && timeStr !== 0) return null;
  let s = String(timeStr).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/\./g, ':').replace(/\s+/g, '');
  const ampm = s.match(/^(\d{1,2})(:?)(\d{2})?(am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[3] || '0', 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const ap = ampm[4];
    if (h === 12 && ap === 'am') h = 0;
    if (h < 12 && ap === 'pm') h += 12;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  }
  return null;
}

function to12h(hms) {
  if (!hms) return null;
  const parts = String(hms).split(':');
  const hh = parseInt(parts[0] || '0', 10);
  const mm = parseInt(parts[1] || '0', 10);
  const ap = hh >= 12 ? 'pm' : 'am';
  let h = hh % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}.${String(mm).padStart(2, '0')}${ap}`;
}

exports.listSlots = async (req, res, next) => {
  try {
    const combo_id = req.query.combo_id ? Number(req.query.combo_id) : null;
    const date = req.query.date || null;
    const start_date = req.query.start_date || null;
    const end_date = req.query.end_date || null;

    const data = await comboSlotService.list({ combo_id, date, start_date, end_date });
    const mapped = Array.isArray(data)
      ? data.map((row) => ({
          ...row,
          start_time_12h: to12h(row.start_time),
          end_time_12h: to12h(row.end_time),
        }))
      : [];
    res.json({ data: mapped, meta: { count: mapped.length } });
  } catch (err) {
    next(err);
  }
};

exports.getSlotById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await comboSlotService.getById(id);
    res.json({
      ...row,
      start_time_12h: to12h(row.start_time),
      end_time_12h: to12h(row.end_time),
    });
  } catch (err) {
    next(err);
  }
};

exports.createSlot = async (req, res, next) => {
  try {
    const payload = normalizeDateFields(req.body || {});
    const cid = Number(payload.combo_id);
    const st = to24h(payload.start_time);
    const et = to24h(payload.end_time);
    if (!cid || !payload.start_date || !payload.end_date || !st || !et || payload.capacity == null) {
      return res.status(400).json({
        error: 'combo_id, date/start_date, start_time, end_time, capacity are required (time supports 12-hour AM/PM)',
      });
    }
    payload.combo_id = cid;
    payload.capacity = Number(payload.capacity);
    payload.price = payload.price === undefined || payload.price === null ? null : Number(payload.price);
    payload.start_time = st;
    payload.end_time = et;

    const row = await comboSlotService.create(payload);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

exports.updateSlot = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = { ...(req.body || {}) };

    if (payload.start_time) {
      const st = to24h(payload.start_time);
      if (!st) return res.status(400).json({ error: 'Invalid start_time. Use format 01.00pm' });
      payload.start_time = st;
    }
    if (payload.end_time) {
      const et = to24h(payload.end_time);
      if (!et) return res.status(400).json({ error: 'Invalid end_time. Use format 02.30pm' });
      payload.end_time = et;
    }
    if (payload.capacity !== undefined) payload.capacity = Number(payload.capacity);
    if (payload.price !== undefined) {
      payload.price = payload.price === null ? null : Number(payload.price);
    }

    const row = await comboSlotService.update(id, payload);
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.deleteSlot = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const out = await comboSlotService.remove(id);
    res.json(out);
  } catch (err) {
    next(err);
  }
};
