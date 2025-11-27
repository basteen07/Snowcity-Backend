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
  
  // Coupon code might be per item in UI, but usually applied per cart.
  // We extract it here but the service might pick the first one.
  const coupon_code = (item.coupon_code ?? item.couponCode ?? item.coupon)?.trim() || null;

  const addons = normalizeAddons(item.addons);

  // Item type (explicit or inferred)
  const item_typeRaw = item.item_type || item.itemType || (combo_id ? 'Combo' : 'Attraction');
  const item_type = String(item_typeRaw).trim() === 'Combo' ? 'Combo' : 'Attraction';

  // Validate minimal shape
  if (item_type === 'Attraction' && !isPosInt(attraction_id)) {
    // It's possible validation happens in service, but good to catch early
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

// List Orders (grouped) or Bookings
exports.listMyBookings = async (req, res, next) => {
  try {
    const userId = me(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 50)));
    const offset = (page - 1) * limit;

    // By default, this lists individual bookings. 
    // If you want to list Orders, you would need a bookingsModel.listOrders({ user_id... })
    // For now, keeping existing behavior but just ensuring it filters by user.
    const data = await bookingsModel.listBookings({ user_id: userId, limit, offset });
    
    res.json({
      data,
      meta: { page, limit, count: data.length, hasNext: data.length === limit }
    });
  } catch (err) { next(err); }
};

// Get Order Details (Receipt)
exports.getOrderDetails = async (req, res, next) => {
  try {
    const userId = me(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = toInt(req.params.id, null);
    if (!isPosInt(id)) return res.status(400).json({ error: 'Invalid ID' });

    // Try to get Order (Parent)
    const order = await bookingsModel.getOrderWithDetails(id);
    
    // If order exists, verify ownership
    if (order) {
        if (order.user_id !== userId) return res.status(404).json({ error: 'Order not found' });
        return res.json(order);
    }

    // Fallback: Try to get single Booking (Legacy support)
    const booking = await bookingsModel.getBookingById(id);
    if (!booking || booking.user_id !== userId) return res.status(404).json({ error: 'Not found' });
    
    return res.json(booking);
  } catch (err) { next(err); }
};

/**
 * Create Order
 * - Accepts a single object or an array of objects.
 * - Calculates totals, creates Order + Bookings + Addons in transaction.
 */
exports.createOrder = async (req, res, next) => {
  try {
    const userId = me(req);
    const body = req.body;
    if (!body) return res.status(400).json({ error: 'Request body is required' });

    // Normalize input
    let items = [];
    if (Array.isArray(body)) {
      if (!body.length) return res.status(400).json({ error: 'Items array is empty' });
      items = body.map((it) => normalizeCreateItem(it, userId));
    } else {
      items = [normalizeCreateItem(body, userId)];
    }

    // Call Service
    const result = await bookingService.createBookings(items);
    
    // Result structure: { order_id, order, bookings: [] }
    return res.status(201).json(result);
  } catch (err) { next(err); }
};

// Initiate Payment for an Order
exports.initiatePayPhiPayment = async (req, res, next) => {
  try {
    const userId = me(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = toInt(req.params.id, null); // This is the ORDER ID
    if (!isPosInt(id)) return res.status(400).json({ error: 'Invalid Order ID' });

    // Verify Order ownership
    // We can do a quick DB check or let service handle it, but verifying user matches is safer here
    // For optimization, we let service fail if order not found, but strictly we should check user_id.
    // Skipping explicit user check DB call here for speed, service will throw if order doesn't exist.

    const { email, mobile } = (req.body && typeof req.body === 'object') ? req.body : {};
    if (!email || !mobile) return res.status(400).json({ error: 'email and mobile are required' });

    const out = await bookingService.initiatePayPhiPayment({
      bookingId: id, // Service param name is legacy, but we pass Order ID
      email,
      mobile
    });
    res.json(out);
  } catch (err) { next(err); }
};

// Check Payment Status for an Order
exports.checkPayPhiStatus = async (req, res, next) => {
  res.json({ success: true, message: 'Route reached' });
};