const { withTransaction } = require('../config/db');

const attractionsModel = require('../models/attractions.model');
const combosModel = require('../models/combos.model');
const comboSlotsModel = require('../models/comboSlots.model');
const addonsModel = require('../models/addons.model');
const couponsModel = require('../models/coupons.model');
const bookingsModel = require('../models/bookings.model');
const { assertCapacityAndLock, getSlotById } = require('../models/attractionSlots.model');
const { assertCapacityAndLock: assertComboCapacityAndLock } = require('../models/comboSlots.model');

const payphiService = require('./payphiService');
const ticketService = require('./ticketService');
const ticketEmailService = require('./ticketEmailService');

/**
 * Compute totals for a booking:
 * - Base attraction price
 * - Addons (unit price after discount_percent), quantity
 * - Optional coupon (flat/percent), validated against total
 */
async function computeTotals({ attraction_id, combo_id = null, slot_id = null, combo_slot_id = null, quantity = 1, addons = [], coupon_code = null, onDate = null }) {
  if (combo_id) {
    return computeComboTotals({ combo_id, combo_slot_id, quantity, addons, coupon_code, onDate });
  }

  // Attraction base price
  const attraction = await attractionsModel.getAttractionById(attraction_id);
  if (!attraction) {
    const err = new Error('Attraction not found');
    err.status = 404;
    throw err;
  }
  let unitBase = Number(attraction.base_price || 0);
  if (slot_id) {
    const slot = await getSlotById(slot_id);
    if (slot && slot.price != null) unitBase = Number(slot.price);
  }
  const qty = Math.max(1, Number(quantity || 1));
  const base = unitBase * qty;

  // Add-ons
  let addonsTotal = 0;
  const normalizedAddons = [];
  for (const a of Array.isArray(addons) ? addons : []) {
    if (!a || a.addon_id == null) continue;
    const row = await addonsModel.getAddonById(a.addon_id);
    if (!row) continue;
    const qty = Math.max(1, Number(a.quantity || 1));
    const unit = Number(row.price || 0) * (1 - Number(row.discount_percent || 0) / 100);
    const line = unit * qty;
    addonsTotal += line;
    normalizedAddons.push({ addon_id: row.addon_id, quantity: qty, price: unit });
  }

  let total = base + addonsTotal;

  // Coupon discount
  let discount = 0;
  if (coupon_code) {
    const coupon = await couponsModel.getCouponByCode(coupon_code, { activeOnly: true, onDate });
    if (coupon) {
      const disc = await couponsModel.computeDiscount(coupon, total);
      discount = Number(disc.discount || 0);
    }
  }

  const final_amount = Math.max(0, total - discount);

  return {
    attraction,
    unit_price: Number(unitBase.toFixed(2)),
    quantity: qty,
    total_amount: Number(total.toFixed(2)),
    discount_amount: Number(discount.toFixed(2)),
    final_amount: Number(final_amount.toFixed(2)),
    addonsNormalized: normalizedAddons,
  };
}

async function computeComboTotals({ combo_id, combo_slot_id = null, quantity = 1, addons = [], coupon_code = null, onDate = null }) {
  const combo = await combosModel.getComboById(combo_id);
  if (!combo) {
    const err = new Error('Combo not found');
    err.status = 404;
    throw err;
  }

  let unitBase = Number(combo.combo_price || 0);
  if (combo_slot_id) {
    const slot = await comboSlotsModel.getSlotById(combo_slot_id);
    if (slot && slot.price != null) unitBase = Number(slot.price);
  }

  const qty = Math.max(1, Number(quantity || 1));
  const base = unitBase * qty;

  let addonsTotal = 0;
  const normalizedAddons = [];
  for (const a of Array.isArray(addons) ? addons : []) {
    if (!a || a.addon_id == null) continue;
    const row = await addonsModel.getAddonById(a.addon_id);
    if (!row) continue;
    const q = Math.max(1, Number(a.quantity || 1));
    const unit = Number(row.price || 0) * (1 - Number(row.discount_percent || 0) / 100);
    const line = unit * q;
    addonsTotal += line;
    normalizedAddons.push({ addon_id: row.addon_id, quantity: q, price: unit });
  }

  let total = base + addonsTotal;
  let discount = 0;
  if (coupon_code) {
    const coupon = await couponsModel.getCouponByCode(coupon_code, { activeOnly: true, onDate });
    if (coupon) {
      const disc = await couponsModel.computeDiscount(coupon, total);
      discount = Number(disc.discount || 0);
    }
  }

  const final_amount = Math.max(0, total - discount);

  return {
    combo,
    unit_price: Number(unitBase.toFixed(2)),
    quantity: qty,
    total_amount: Number(total.toFixed(2)),
    discount_amount: Number(discount.toFixed(2)),
    final_amount: Number(final_amount.toFixed(2)),
    addonsNormalized: normalizedAddons,
  };
}

/**
 * Create a booking (user/admin).
 * If slot_id is provided, performs a FOR UPDATE capacity check to serialize concurrent bookings.
 * Persists add-ons snapshot into booking_addons.
 * user_id can be null for guest bookings (will be updated after OTP verification).
 */
async function createBooking({
  user_id = null,
  attraction_id,
  slot_id = null,
  quantity = 1,
  addons = [],
  coupon_code = null,
  payment_mode = 'Online',
  booking_date = null, // 'YYYY-MM-DD'
}) {
  const onDate = booking_date || new Date().toISOString().slice(0, 10);
  const totals = await computeTotals({ attraction_id, slot_id, quantity, addons, coupon_code, onDate });

  return withTransaction(async (client) => {
    // Slot concurrency-safe capacity check (if applicable)
    if (slot_id) {
      await assertCapacityAndLock(client, slot_id, quantity);
    }

    // Insert booking (user_id can be null for guest bookings)
    const ins = await client.query(
      `INSERT INTO bookings
         (user_id, attraction_id, slot_id, quantity, total_amount, discount_amount, payment_mode, booking_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date)
       RETURNING *`,
      [
        user_id,
        attraction_id,
        slot_id,
        totals.quantity,
        totals.total_amount,
        totals.discount_amount,
        payment_mode,
        onDate,
      ]
    );
    const booking = ins.rows[0];

    // Persist add-ons snapshot
    for (const a of totals.addonsNormalized) {
      await client.query(
        `INSERT INTO booking_addons (booking_id, addon_id, quantity, price)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (booking_id, addon_id)
         DO UPDATE SET quantity = EXCLUDED.quantity, price = EXCLUDED.price, updated_at = NOW()`,
        [booking.booking_id, a.addon_id, a.quantity, a.price]
      );
    }

    return booking;
  });
}

async function createComboBooking({
  user_id = null,
  combo_id,
  combo_slot_id = null,
  quantity = 1,
  addons = [],
  coupon_code = null,
  payment_mode = 'Online',
  booking_date = null,
  booking_time = null,
}) {
  const onDate = booking_date || new Date().toISOString().slice(0, 10);
  const totals = await computeComboTotals({ combo_id, combo_slot_id, quantity, addons, coupon_code, onDate });

  return withTransaction(async (client) => {
    if (combo_slot_id) {
      await assertComboCapacityAndLock(client, combo_slot_id, quantity);
    }

    const ins = await client.query(
      `INSERT INTO bookings
         (user_id, combo_id, combo_slot_id, quantity, booking_date, booking_time, total_amount, discount_amount, payment_mode)
       VALUES ($1, $2, $3, $4, $5::date, $6::time, $7, $8, $9)
       RETURNING *`,
      [
        user_id,
        combo_id,
        combo_slot_id,
        totals.quantity,
        onDate,
        booking_time,
        totals.total_amount,
        totals.discount_amount,
        payment_mode,
      ]
    );
    const booking = ins.rows[0];

    for (const a of totals.addonsNormalized) {
      await client.query(
        `INSERT INTO booking_addons (booking_id, addon_id, quantity, price)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (booking_id, addon_id)
         DO UPDATE SET quantity = EXCLUDED.quantity, price = EXCLUDED.price, updated_at = NOW()`,
        [booking.booking_id, a.addon_id, a.quantity, a.price]
      );
    }

    return booking;
  });
}

/**
 * Update booking with user_id after OTP verification
 */
async function assignBookingToUser(booking_id, user_id) {
  const bookingsModel = require('../models/bookings.model');
  return await bookingsModel.updateBooking(booking_id, { user_id });
}

/**
 * Cancel a booking (marks booking_status = Cancelled, adjusts payment_status if Pending).
 */
async function cancelBooking(booking_id) {
  return bookingsModel.cancelBooking(booking_id);
}

/**
 * Initiate PayPhi payment (builds redirect URL, stores tranCtx in payment_ref).
 * Requires email + mobile.
 */
async function initiatePayPhiPayment(booking_id, { email, mobile, addlParam1 = '', addlParam2 = '' } = {}) {
  const booking = await bookingsModel.getBookingById(booking_id);
  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }
  if (booking.payment_status === 'Completed') {
    const err = new Error('Payment already completed');
    err.status = 400;
    throw err;
  }

  const merchantTxnNo = booking.booking_ref;
  const amount = booking.final_amount;

  const { redirectUrl, tranCtx, raw } = await payphiService.initiate({
    merchantTxnNo,
    amount,
    customerEmailID: email,
    customerMobileNo: mobile,
    addlParam1: addlParam1 || String(booking.booking_id),
    addlParam2,
  });

  if (tranCtx) {
    await bookingsModel.updateBooking(booking.booking_id, { payment_ref: tranCtx });
  }

  const responseCode =
    raw?.responseCode ||
    raw?.respCode ||
    raw?.code ||
    raw?.response?.responseCode ||
    null;
  const responseMessage =
    raw?.responseMessage ||
    raw?.respMessage ||
    raw?.message ||
    raw?.response?.responseMessage ||
    null;

  return {
    redirectUrl,
    tranCtx,
    responseCode,
    responseMessage,
    response: raw,
  };
}

/**
 * Check PayPhi status. If successful, marks booking payment_status = Completed.
 */
async function checkPayPhiStatus(booking_id) {
  const booking = await bookingsModel.getBookingById(booking_id);
  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }
  const merchantTxnNo = booking.booking_ref;
  const originalTxnNo = booking.booking_ref;

  const { success, raw } = await payphiService.status({
    merchantTxnNo,
    originalTxnNo,
    amount: booking.final_amount,
  });

  if (success && booking.payment_status !== 'Completed') {
    await bookingsModel.setPayment(booking.booking_id, {
      payment_status: 'Completed',
      payment_ref: raw?.transactionId || raw?.data?.transactionId || booking.payment_ref,
    });
    try {
      const urlPath = await ticketService.generateTicket(booking.booking_id);
      await bookingsModel.updateBooking(booking.booking_id, { ticket_pdf: urlPath });
      try { await ticketEmailService.sendTicketEmail(booking.booking_id); } catch (e) {}
    } catch (e) {
      // Non-fatal
    }
  }

  return { success, response: raw };
}

module.exports = {
  // core
  computeTotals,
  createBooking,
  createComboBooking,
  assignBookingToUser,
  cancelBooking,

  // PayPhi
  initiatePayPhiPayment,
  checkPayPhiStatus,
};