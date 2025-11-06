const combosModel = require('../models/combos.model');

async function list({ active = null } = {}) {
  return combosModel.listCombos({ active });
}

async function getById(id) {
  const row = await combosModel.getComboById(id);
  if (!row) {
    const err = new Error('Combo not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function create(payload) {
  return combosModel.createCombo(payload);
}

async function update(id, payload) {
  const row = await combosModel.updateCombo(id, payload);
  if (!row) {
    const err = new Error('Combo not found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function remove(id) {
  const ok = await combosModel.deleteCombo(id);
  if (!ok) {
    const err = new Error('Combo not found');
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