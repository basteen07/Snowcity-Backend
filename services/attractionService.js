const attractionsModel = require('../models/attractions.model');
const { applyOfferPricing } = require('./offerPricing');

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

async function withPricing(row) {
  if (!row) return row;
  const base = toNumber(row.base_price ?? row.price ?? row.amount ?? 0, 0);
  const pricing = await applyOfferPricing({
    targetType: 'attraction',
    targetId: row.attraction_id,
    baseAmount: base,
  });

  row.pricing = {
    base_price: base,
    final_price: pricing.unit,
    discount_amount: pricing.discount,
    discount_percent: pricing.discount_percent,
    offer: pricing.offer,
  };
  row.display_price = pricing.unit;
  row.offer = pricing.offer;
  row.offer_discount_amount = pricing.discount;
  row.offer_discount_percent = pricing.discount_percent;

  return row;
}

async function list({ search = '', active = null, limit = 50, offset = 0 }) {
  const rows = await attractionsModel.listAttractions({ search, active, limit, offset });
  return Promise.all(rows.map((row) => withPricing({ ...row })));
}

async function getById(id) {
  const row = await attractionsModel.getAttractionById(id);
  if (!row) {
    const err = new Error('Attraction not found');
    err.status = 404;
    throw err;
  }
  return withPricing({ ...row });
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