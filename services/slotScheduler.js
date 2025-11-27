const slotsModel = require('../models/attractionSlots.model');
const comboSlotsModel = require('../models/comboSlots.model');
const holidayService = require('./holidayService');

const ATTR_DEFAULTS = {
  startHour: 10,
  endHour: 20,
  durationMinutes: 60,
  capacity: 150,
};

const COMBO_DEFAULTS = {
  startHour: 10,
  endHour: 20,
  durationMinutes: 120,
  capacity: 150,
};

function toDateOnly(dateLike) {
  const date = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(date.getTime())) return new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildHourBlocks({ startHour, endHour, durationMinutes }) {
  const blocks = [];
  const duration = durationMinutes;
  for (let minutes = startHour * 60; minutes + duration <= endHour * 60; minutes += duration) {
    const startHours = Math.floor(minutes / 60);
    const startMins = minutes % 60;
    const endMinutes = minutes + duration;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const start = `${String(startHours).padStart(2, '0')}:${String(startMins).padStart(2, '0')}:00`;
    const end = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;
    blocks.push({ start, end });
  }
  return blocks;
}

async function getHolidaySet(fromDate, toDate) {
  const holidays = await holidayService.list({ from: fromDate, to: toDate });
  const set = new Set();
  holidays.forEach((h) => {
    if (h?.holiday_date) set.add(String(h.holiday_date));
  });
  return set;
}

async function createAttractionSlotIfNeeded(payload) {
  try {
    const row = await slotsModel.createSlot(payload);
    return !!row;
  } catch (err) {
    if (err.code === '23505' || /duplicate key/i.test(err.message)) {
      return false;
    }
    throw err;
  }
}

async function createComboSlotIfNeeded(payload) {
  try {
    const row = await comboSlotsModel.createSlot(payload);
    return !!row;
  } catch (err) {
    if (err.code === '23505' || /duplicate key/i.test(err.message)) {
      return false;
    }
    throw err;
  }
}

async function generateAttractionSlots({
  attractionId,
  startDate = new Date(),
  days = 30,
  startHour = ATTR_DEFAULTS.startHour,
  endHour = ATTR_DEFAULTS.endHour,
  durationMinutes = ATTR_DEFAULTS.durationMinutes,
  capacity = ATTR_DEFAULTS.capacity,
  skipHolidays = true,
} = {}) {
  if (!attractionId) return { created: 0, skipped: 0 };
  const start = toDateOnly(startDate);
  const end = addDays(start, days - 1);
  const holidaySet = skipHolidays ? await getHolidaySet(formatDate(start), formatDate(end)) : new Set();
  const blocks = buildHourBlocks({ startHour, endHour, durationMinutes });

  let created = 0;
  let skipped = 0;

  for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const dateStr = formatDate(date);
    if (holidaySet.has(dateStr)) {
      skipped += blocks.length;
      continue;
    }
    for (const block of blocks) {
      const ok = await createAttractionSlotIfNeeded({
        attraction_id: attractionId,
        start_date: dateStr,
        end_date: dateStr,
        start_time: block.start,
        end_time: block.end,
        capacity,
        available: true,
      });
      if (ok) created += 1;
      else skipped += 1;
    }
  }
  return { created, skipped };
}

async function generateComboSlots({
  comboId,
  startDate = new Date(),
  days = 30,
  startHour = COMBO_DEFAULTS.startHour,
  endHour = COMBO_DEFAULTS.endHour,
  durationMinutes = COMBO_DEFAULTS.durationMinutes,
  capacity = COMBO_DEFAULTS.capacity,
  skipHolidays = true,
} = {}) {
  if (!comboId) return { created: 0, skipped: 0 };
  const start = toDateOnly(startDate);
  const end = addDays(start, days - 1);
  const holidaySet = skipHolidays ? await getHolidaySet(formatDate(start), formatDate(end)) : new Set();
  const blocks = buildHourBlocks({ startHour, endHour, durationMinutes });

  let created = 0;
  let skipped = 0;

  for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const dateStr = formatDate(date);
    if (holidaySet.has(dateStr)) {
      skipped += blocks.length;
      continue;
    }
    for (const block of blocks) {
      const ok = await createComboSlotIfNeeded({
        combo_id: comboId,
        start_date: dateStr,
        end_date: dateStr,
        start_time: block.start,
        end_time: block.end,
        capacity,
        available: true,
      });
      if (ok) created += 1;
      else skipped += 1;
    }
  }
  return { created, skipped };
}

async function extendAttractionSchedule({ attractionId, daysAhead = 30 }) {
  const today = new Date();
  return generateAttractionSlots({ attractionId, startDate: today, days: daysAhead, skipHolidays: false });
}

async function extendComboSchedule({ comboId, daysAhead = 30 }) {
  const today = new Date();
  return generateComboSlots({ comboId, startDate: today, days: daysAhead, skipHolidays: false });
}

module.exports = {
  generateAttractionSlots,
  generateComboSlots,
  extendAttractionSchedule,
  extendComboSchedule,
  ATTR_DEFAULTS,
  COMBO_DEFAULTS,
};
