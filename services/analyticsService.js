const analyticsModel = require('../models/analytics.model');

async function get({ attraction_id = null, from = null, to = null } = {}) {
  return analyticsModel.getAnalytics({ attraction_id, from, to });
}

async function getSummary({ from = null, to = null } = {}) {
  return analyticsModel.getSummary({ from, to });
}

async function upsertDaily(entry) {
  return analyticsModel.upsertDaily(entry);
}

module.exports = {
  get,
  getSummary,
  upsertDaily,
};