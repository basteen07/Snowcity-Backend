const comboSlotsModel = require('../models/comboSlots.model');

async function list({ combo_id = null, date = null, start_date = null, end_date = null } = {}) {
  return comboSlotsModel.listSlots({ combo_id, date, start_date, end_date });
}

async function getById(id) {
  const row = await comboSlotsModel.getSlotById(id);
  if (!row) {
    const err = new Error('Combo slot not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function create(payload) {
  const overlap = await comboSlotsModel.slotOverlapExists(payload);
  if (overlap) {
    const err = new Error('Overlapping slot exists for this combo/date/time window');
    err.status = 409;
    throw err;
  }
  return comboSlotsModel.createSlot(payload);
}

async function update(id, payload) {
  if (payload.combo_id || payload.start_date || payload.end_date || payload.start_time || payload.end_time) {
    const current = await comboSlotsModel.getSlotById(id);
    if (!current) {
      const err = new Error('Combo slot not found');
      err.status = 404;
      throw err;
    }
    const overlap = await comboSlotsModel.slotOverlapExists({
      combo_id: payload.combo_id ?? current.combo_id,
      start_date: payload.start_date ?? current.start_date,
      end_date: payload.end_date ?? current.end_date,
      start_time: payload.start_time ?? current.start_time,
      end_time: payload.end_time ?? current.end_time,
      exclude_slot_id: id,
    });
    if (overlap) {
      const err = new Error('Overlapping slot exists for this combo/date/time window');
      err.status = 409;
      throw err;
    }
  }
  const row = await comboSlotsModel.updateSlot(id, payload);
  if (!row) {
    const err = new Error('Combo slot not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function remove(id) {
  const ok = await comboSlotsModel.deleteSlot(id);
  if (!ok) {
    const err = new Error('Combo slot not found');
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
