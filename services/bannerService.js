const bannersModel = require('../models/banners.model');

async function list({ active = true, attraction_id = null, offer_id = null, limit = 50, offset = 0 } = {}) {
  return bannersModel.listBanners({ active, attraction_id, offer_id, limit, offset });
}

async function getById(id) {
  const row = await bannersModel.getBannerById(id);
  if (!row) {
    const err = new Error('Banner not found');
    err.status = 404;
    throw err;
  }
  return row;
}

module.exports = {
  list,
  getById,
};