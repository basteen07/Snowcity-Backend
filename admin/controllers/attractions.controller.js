const attractionsModel = require('../../models/attractions.model');
const slotScheduler = require('../../services/slotScheduler');

const slotsModel = require('../../models/attractionSlots.model');
const holidayService = require('../../services/holidayService');

const SLOT_CAPACITY = 150;
const ATTR_START_HOUR = 10;
const ATTR_END_HOUR = 20;
const ATTR_SLOT_DURATION_MIN = 60;

async function listHolidayDatesMap() {
  const holidays = await holidayService.list();
  const map = new Set();
  holidays.forEach((h) => {
    if (h?.holiday_date) map.add(String(h.holiday_date));
  });
  return map;
}

function makeSlotCode({ title = '', date, slotIndex, capacity = SLOT_CAPACITY }) {
  const nameLetter = title?.trim()?.charAt(0)?.toLowerCase() || 'x';
  const monthLetter = new Date(date).toLocaleString('en-US', { month: 'long' }).charAt(0).toLowerCase();
  const day = new Date(date).getUTCDate();
  const dd = String(day).padStart(2, '0');
  const ss = String(slotIndex).padStart(2, '0');
  const cap = String(capacity).padStart(3, '0');
  return `${nameLetter}${monthLetter}${dd}${ss}${cap}`;
}

async function autoGenerateAttractionSlots(attraction) {
  if (!attraction?.attraction_id) return;
  const holidays = await listHolidayDatesMap();
  const today = new Date();
  const rangeEnd = new Date();
  rangeEnd.setUTCMonth(rangeEnd.getUTCMonth() + 1);

  for (let dt = new Date(today); dt <= rangeEnd; dt.setUTCDate(dt.getUTCDate() + 1)) {
    const dayStr = dt.toISOString().slice(0, 10);
    if (holidays.has(dayStr)) continue;

    let slotIdx = 1;
    for (let hour = ATTR_START_HOUR; hour < ATTR_END_HOUR; hour += ATTR_SLOT_DURATION_MIN / 60) {
      const start = `${String(hour).padStart(2, '0')}:00:00`;
      const endHour = hour + ATTR_SLOT_DURATION_MIN / 60;
      if (endHour > ATTR_END_HOUR) break;
      const end = `${String(endHour).padStart(2, '0')}:00:00`;

      const code = makeSlotCode({ title: attraction.title || attraction.name, date: dayStr, slotIndex: slotIdx });
      await slotsModel.createSlot({
        attraction_id: attraction.attraction_id,
        start_date: dayStr,
        end_date: dayStr,
        start_time: start,
        end_time: end,
        capacity: SLOT_CAPACITY,
        available: true,
        slot_code: code,
      });
      slotIdx += 1;
    }
  }
}

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
    try {
      await slotScheduler.generateAttractionSlots({
        attractionId: row.attraction_id,
        days: 30,
        skipHolidays: false,
      });
    } catch (scheduleErr) {
      // Log and continue without blocking attraction creation
      console.error('Auto slot generation failed for attraction', row.attraction_id, scheduleErr);
    }
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