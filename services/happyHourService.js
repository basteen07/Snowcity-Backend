const happyHoursModel = require('../models/happyHours.model');

async function list({ attraction_id = null } = {}) {
  return happyHoursModel.listHappyHours({ attraction_id });
}

async function getById(id) {
  const row = await happyHoursModel.getHappyHourById(id);
  if (!row) {
    const err = new Error('Happy hour not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function create(payload) {
  const overlap = await happyHoursModel.overlapExists({
    attraction_id: payload.attraction_id,
    start_time: payload.start_time,
    end_time: payload.end_time,
  });
  if (overlap) {
    const err = new Error('Overlapping happy hour exists for this attraction/time range');
    err.status = 409;
    throw err;
  }
  return happyHoursModel.createHappyHour(payload);
}

async function update(id, payload) {
  const current = await happyHoursModel.getHappyHourById(id);
  if (!current) {
    const err = new Error('Happy hour not found');
    err.status = 404;
    throw err;
  }
  const overlap = await happyHoursModel.overlapExists({
    attraction_id: payload.attraction_id ?? current.attraction_id,
    start_time: payload.start_time ?? current.start_time,
    end_time: payload.end_time ?? current.end_time,
    exclude_id: id,
  });
  if (overlap) {
    const err = new Error('Overlapping happy hour exists for this attraction/time range');
    err.status = 409;
    throw err;
  }
  const row = await happyHoursModel.updateHappyHour(id, payload);
  return row;
}

async function remove(id) {
  const ok = await happyHoursModel.deleteHappyHour(id);
  if (!ok) {
    const err = new Error('Happy hour not found');
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