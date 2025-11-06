const usersModel = require('../models/users.model');

async function getProfile(userId) {
  return usersModel.getUserById(userId);
}

async function updateProfile(userId, fields) {
  // Prevent changing sensitive fields here if needed
  const allowed = ['name', 'phone', 'email'];
  const payload = {};
  for (const k of allowed) {
    if (fields[k] !== undefined) payload[k] = fields[k];
  }
  return usersModel.updateUser(userId, payload);
}

module.exports = {
  getProfile,
  updateProfile,
};