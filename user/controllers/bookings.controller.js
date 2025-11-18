'use strict';

const bookingsModel = require('../../models/bookings.model');
const bookingService = require('../../services/bookingService');

const me = (req) => req.user?.id || req.user?.user_id || null;

const toInt = (n, d = null) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : d;
};
const isPosInt = (n) => Number.isInteger(n) && n > 0;

function normalizeAddons(addons) {
  if (!Array.isArray(addons)) return [];
  return addons
    .map((a) => ({
      addon_id: toInt(a?.addon_id ?? a?.id ?? a?.addonId, null),
      quantity: Math.max(1, toInt(a?.quantity ?? a?.qty, 1))
    }))
    .filter((a) => isPosInt(a.addon_id));
}

function normalizeCreateItem(input = {}, userId = null) {
  const item = input || {};

  // IDs (accept snake_case and camelCase)
  const attraction_id = toInt(item.attraction_id ?? item.attractionId, null);
  const slot_id = toInt(item.slot_id ?? item.slotId, null);
  const combo_id = toInt(item.combo_id ?? item.comboId, null);
  const combo_slot_id = toInt(item.combo_slot_id ?? item.comboSlotId, null);
  const offer_id = toInt(item.offer_id ?? item.offerId, null);

  // Basics
  const quantity = Math.max(1, toInt(item.quantity ?? item.qty, 1));
  const booking_date = item.booking_date || item.date || null;
  const payment_mode = item.payment_mode || 'Online';
  const coupon_code = (item.coupon_code ?? item.couponCode ?? item.coupon)?.trim() || null;

  const addons = normalizeAddons(item.addons);

  // Item type (explicit or inferred)
  const item_typeRaw = item.item_type || item.itemType || (combo_id ? 'Combo' : 'Attraction');
  const item_type = String(item_typeRaw).trim() === 'Combo' ? 'Combo' : 'Attraction';

  // Validate minimal shape
  if (item_type === 'Attraction' && !isPosInt(attraction_id)) {
    const err = new Error('attraction_id is required for Attraction booking'); err.status = 400; throw err;
  }
  if (item_type === 'Combo' && !isPosInt(combo_id)) {
    const err = new Error('combo_id is required for Combo booking'); err.status = 400; throw err;
  }

  return {
    user_id: userId || null,
    item_type,
    attraction_id: item_type === 'Attraction' ? attraction_id : null,
    slot_id: item_type === 'Attraction' ? slot_id : null,
    combo_id: item_type === 'Combo' ? combo_id : null,
    combo_slot_id: item_type === 'Combo' ? combo_slot_id : null,
    offer_id: offer_id || null,
    coupon_code,
    quantity,
    addons,
    booking_date,
    payment_mode
  };
}

/* ====== Controllers ====== */

exports.listMyBookings = async (req, res, next) => {
  try {
    const userId = me(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 50)));
    const offset = (page - 1) * limit;

    const data = await bookingsModel.listBookings({ user_id: userId, limit, offset });
    res.json({
      data,
      meta: { page, limit, count: data.length, hasNext: data.length === limit }
    });
  } catch (err) { next(err); }
};

exports.getMyBookingById = async (req, res, next) => {
  try {
    const userId = me(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = toInt(req.params.id, null);
    if (!isPosInt(id)) return res.status(400).json({ error: 'Invalid booking id' });

    const row = await bookingsModel.getBookingById(id);
    if (!row || row.user_id !== userId) return res.status(404).json({ error: 'Booking not found' });

    res.json(row);
  } catch (err) { next(err); }
};

/**
 * Create booking(s)
 * - Accepts a single object or an array of objects.
 * - Each item: attraction or combo + optional offer_id, coupon_code, addons, quantity, booking_date, slot/combo_slot.
 */
exports.createBooking = async (req, res, next) => {
  try {
    const userId = me(req);
    const body = req.body;
    if (!body) return res.status(400).json({ error: 'Request body is required' });

    // Multiple bookings (atomic)
    if (Array.isArray(body)) {
      if (!body.length) return res.status(400).json({ error: 'Items array is empty' });
      const items = body.map((it) => normalizeCreateItem(it, userId));
      const bookings = await bookingService.createBookings(items);
      return res.status(201).json({ data: bookings });
    }

    // Single booking
    const input = normalizeCreateItem(body, userId);
    const booking = await bookingService.createBooking(input);
    return res.status(201).json(booking);
  } catch (err) { next(err); }
};

exports.initiatePayPhiPayment = async (req, res, next) => {
  try {
    const userId = me(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = toInt(req.params.id, null);
    if (!isPosInt(id)) return res.status(400).json({ error: 'Invalid booking id' });

    const b = await bookingsModel.getBookingById(id);
    if (!b || b.user_id !== userId) return res.status(404).json({ error: 'Booking not found' });

    const { email, mobile } = (req.body && typeof req.body === 'object') ? req.body : {};
    if (!email || !mobile) return res.status(400).json({ error: 'email and mobile are required' });

    const out = await bookingService.initiatePayPhiPayment(id, {
      email,
      mobile,
      addlParam1: String(id),
      addlParam2: 'SnowCity'
    });
    res.json(out);
  } catch (err) { next(err); }
};

exports.checkPayPhiStatus = async (req, res, next) => {
  try {
    const userId = me(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = toInt(req.params.id, null);
    if (!isPosInt(id)) return res.status(400).json({ error: 'Invalid booking id' });

    const b = await bookingsModel.getBookingById(id);
    if (!b || b.user_id !== userId) return res.status(404).json({ error: 'Booking not found' });

    const out = await bookingService.checkPayPhiStatus(id);
    res.json(out);
  } catch (err) { next(err); }
};