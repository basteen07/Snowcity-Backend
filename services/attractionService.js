const attractionsModel = require('../models/attractions.model');
const { applyOfferPricing } = require('./offerPricing');

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

async function withPricing(row, { booking_date = null, booking_time = null } = {}) {
  if (!row) return row;
  const base = toNumber(row.base_price ?? row.price ?? row.amount ?? 0, 0);
  const pricing = await applyOfferPricing({
    targetType: 'attraction',
    targetId: row.attraction_id,
    baseAmount: base,
    booking_date,
    booking_time,
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

async function list({ search = '', active = null, limit = 50, offset = 0, booking_date = null, booking_time = null }) {
  const rows = await attractionsModel.listAttractions({ search, active, limit, offset });
  return Promise.all(rows.map((row) => withPricing({ ...row }, { booking_date, booking_time })));
}

async function getById(id, { booking_date = null, booking_time = null } = {}) {
  const row = await attractionsModel.getAttractionById(id);
  if (!row) {
    const err = new Error('Attraction not found');
    err.status = 404;
    throw err;
  }
  return withPricing({ ...row }, { booking_date, booking_time });
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