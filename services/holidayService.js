const holidaysModel = require('../models/holidays.model');

async function list({ from = null, to = null, upcoming = false } = {}) {
  return holidaysModel.listHolidays({ from, to, upcoming });
}

async function getById(id) {
  const row = await holidaysModel.getHolidayById(id);
  if (!row) {
    const err = new Error('Holiday not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function create(payload) {
  return holidaysModel.createHoliday(payload);
}

async function update(id, payload) {
  const row = await holidaysModel.updateHoliday(id, payload);
  if (!row) {
    const err = new Error('Holiday not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function remove(id) {
  const ok = await holidaysModel.deleteHoliday(id);
  if (!ok) {
    const err = new Error('Holiday not found');
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