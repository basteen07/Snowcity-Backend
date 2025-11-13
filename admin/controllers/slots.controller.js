const slotsModel = require('../../models/attractionSlots.model');

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
  const ampm = s.match(/^(\d{1,2})(?::?(\d{1,2}))?(?::?(\d{1,2}))?(am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2] || '0', 10);
    const sec = parseInt(ampm[3] || '0', 10);
    const ap = ampm[4];
    if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(sec)) return null;
    if (h === 12 && ap === 'am') h = 0;
    if (h < 12 && ap === 'pm') h += 12;
    if (h < 0 || h > 23 || m < 0 || m > 59 || sec < 0 || sec > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  const m24 = s.match(/^(\d{1,2}):?(\d{2})(?::?(\d{2}))?$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    const sec = parseInt(m24[3] || '0', 10);
    if (h < 0 || h > 23 || m < 0 || m > 59 || sec < 0 || sec > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
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
    const attraction_id = req.query.attraction_id ? Number(req.query.attraction_id) : null;
    const date = req.query.date || null;
    const start_date = req.query.start_date || null;
    const end_date = req.query.end_date || null;

    const data = await slotsModel.listSlots({ attraction_id, date, start_date, end_date });
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
    const row = await slotsModel.getSlotById(id);
    if (!row) return res.status(404).json({ error: 'Slot not found' });
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
    const aid = Number(payload.attraction_id);
    const st = to24h(payload.start_time);
    const et = to24h(payload.end_time);
    if (!aid || !payload.start_date || !payload.end_date || !st || !et || !payload.capacity) {
      return res.status(400).json({
        error: 'attraction_id, date/start_date, start_time, end_time, capacity are required (time supports 12-hour AM/PM)',
      });
    }
    payload.start_time = st;
    payload.end_time = et;
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

exports.createSlotsBulk = async (req, res, next) => {
  try {
    const {
      attraction_id,
      start_date,
      end_date,
      start_time,
      end_time,
      duration_minutes,
      capacity,
      price = null,
      available = true,
    } = req.body || {};

    const aid = Number(attraction_id);
    const dur = Number(duration_minutes);
    const cap = Number(capacity);
    if (!aid || !start_date || !end_date || !start_time || !end_time || !dur || !cap) {
      return res.status(400).json({ error: 'attraction_id, start_date, end_date, start_time, end_time, duration_minutes, capacity are required' });
    }

    const sd = new Date(`${start_date}T00:00:00Z`);
    const ed = new Date(`${end_date}T00:00:00Z`);
    if (Number.isNaN(sd.getTime()) || Number.isNaN(ed.getTime()) || sd > ed) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    function parseMinutes(hm) {
      const norm = to24h(hm);
      if (!norm) return NaN;
      const [h, m] = norm.split(':').map((x) => Number(x));
      return h * 60 + (m || 0);
    }
    function fmtHM(mins) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    }

    const startM = parseMinutes(start_time);
    const endM = parseMinutes(end_time);
    if (!(startM < endM) || dur <= 0) {
      return res.status(400).json({ error: 'Invalid time range or duration' });
    }

    let created = 0;
    let skipped = 0;
    let conflicts = [];

    for (let d = new Date(sd); d <= ed; d.setUTCDate(d.getUTCDate() + 1)) {
      const dayStr = d.toISOString().slice(0, 10);
      for (let cur = startM; cur + dur < endM; cur += dur) {
        const st = fmtHM(cur);
        const et = fmtHM(cur + dur);
        const overlap = await slotsModel.slotOverlapExists({
          attraction_id: aid,
          start_date: dayStr,
          end_date: dayStr,
          start_time: st,
          end_time: et,
        });
        if (overlap) {
          skipped += 1;
          conflicts.push({ date: dayStr, start_time: st, end_time: et });
          continue;
        }
        try {
          await slotsModel.createSlot({
            attraction_id: aid,
            start_date: dayStr,
            end_date: dayStr,
            start_time: st,
            end_time: et,
            capacity: cap,
            price,
            available: Boolean(available),
          });
          created += 1;
        } catch (e) {
          skipped += 1;
          conflicts.push({ date: dayStr, start_time: st, end_time: et, error: e.code || e.message });
          continue;
        }
      }
    }

    res.status(201).json({ created, skipped, conflicts });
  } catch (err) {
    next(err);
  }
};