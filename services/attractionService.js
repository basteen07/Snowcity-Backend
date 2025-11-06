const attractionsModel = require('../models/attractions.model');

async function list({ search = '', active = null, limit = 50, offset = 0 }) {
  return attractionsModel.listAttractions({ search, active, limit, offset });
}

async function getById(id) {
  const row = await attractionsModel.getAttractionById(id);
  if (!row) {
    const err = new Error('Attraction not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function create(payload) {
  return attractionsModel.createAttraction(payload);
}

async function update(id, payload) {
  const row = await attractionsModel.updateAttraction(id, payload);
  if (!row) {
    const err = new Error('Attraction not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function remove(id) {
  const ok = await attractionsModel.deleteAttraction(id);
  if (!ok) {
    const err = new Error('Attraction not found');
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