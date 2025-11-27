const slotsModel = require('../models/attractionSlots.model');
const holidayService = require('./holidayService');

async function excludeHolidaySlots(slots = []) {
  if (!slots.length) return slots;
  const dates = slots
    .map((slot) => slot?.start_date)
    .filter(Boolean)
    .sort();
  if (!dates.length) return slots;
  const from = dates[0];
  const to = dates[dates.length - 1];
  const holidays = await holidayService.list({ from, to });
  if (!holidays?.length) return slots;
  const holidaySet = new Set(holidays.map((h) => String(h.holiday_date)));
  return slots.filter((slot) => !holidaySet.has(String(slot.start_date)));
}

async function list({ attraction_id = null, date = null, start_date = null, end_date = null }) {
  const slots = await slotsModel.listSlots({ attraction_id, date, start_date, end_date });
  return excludeHolidaySlots(slots);
}

async function getById(id) {
  const row = await slotsModel.getSlotById(id);
  if (!row) {
    const err = new Error('Slot not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function create(payload) {
  // Overlap protection
  const overlap = await slotsModel.slotOverlapExists(payload);
  if (overlap) {
    const err = new Error('Overlapping slot exists for this attraction/date/time window');
    err.status = 409;
    throw err;
  }
  return slotsModel.createSlot(payload);
}

async function update(id, payload) {
  // Validate overlap if relevant fields changed
  if (payload.attraction_id || payload.start_date || payload.end_date || payload.start_time || payload.end_time) {
    const current = await slotsModel.getSlotById(id);
    if (!current) {
      const err = new Error('Slot not found');
      err.status = 404;
      throw err;
    }
    const overlap = await slotsModel.slotOverlapExists({
      attraction_id: payload.attraction_id ?? current.attraction_id,
      start_date: payload.start_date ?? current.start_date,
      end_date: payload.end_date ?? current.end_date,
      start_time: payload.start_time ?? current.start_time,
      end_time: payload.end_time ?? current.end_time,
      exclude_slot_id: id,
    });
    if (overlap) {
      const err = new Error('Overlapping slot exists for this attraction/date/time window');
      err.status = 409;
      throw err;
    }
  }
  const row = await slotsModel.updateSlot(id, payload);
  if (!row) {
    const err = new Error('Slot not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function remove(id) {
  const ok = await slotsModel.deleteSlot(id);
  if (!ok) {
    const err = new Error('Slot not found');
    err.status = 404;
    throw err;
  }
  return { deleted: true };
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};