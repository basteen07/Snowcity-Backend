const settingsModel = require('../models/settings.model');

async function list() {
  return settingsModel.listSettings();
}

async function listPublic() {
  return settingsModel.listPublicSettings();
}

async function get(key) {
  return settingsModel.getSetting(key);
}

async function set(key, value) {
  return settingsModel.setSetting(key, value);
}

async function remove(key) {
  return settingsModel.deleteSetting(key);
}

module.exports = {
  list,
  listPublic,
  get,
  set,
  remove,
};