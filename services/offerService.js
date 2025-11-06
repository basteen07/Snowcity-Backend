const offersModel = require('../models/offers.model');

async function list({ active = null, rule_type = null, date = null, q = '', limit = 50, offset = 0 } = {}) {
  return offersModel.listOffers({ active, rule_type, date, q, limit, offset });
}

async function getById(id) {
  const row = await offersModel.getOfferById(id);
  if (!row) {
    const err = new Error('Offer not found');
    err.status = 404;
    throw err;
  }
  return row;
}

module.exports = {
  list,
  getById,
};