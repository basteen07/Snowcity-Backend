const addonsModel = require('../models/addons.model');

async function list({ active = null } = {}) {
  return addonsModel.listAddons({ active });
}

async function getById(id) {
  const row = await addonsModel.getAddonById(id);
  if (!row) {
    const err = new Error('Addon not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function create(payload) {
  return addonsModel.createAddon(payload);
}

async function update(id, payload) {
  const row = await addonsModel.updateAddon(id, payload);
  if (!row) {
    const err = new Error('Addon not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function remove(id) {
  const ok = await addonsModel.deleteAddon(id);
  if (!ok) {
    const err = new Error('Addon not found');
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