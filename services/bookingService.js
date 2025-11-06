const { withTransaction } = require('../config/db');

const attractionsModel = require('../models/attractions.model');
const addonsModel = require('../models/addons.model');
const couponsModel = require('../models/coupons.model');
const bookingsModel = require('../models/bookings.model');
const { assertCapacityAndLock } = require('../models/attractionSlots.model');

const payphiService = require('./payphiService');

/**
 * Compute totals for a booking:
 * - Base attraction price
 * - Addons (unit price after discount_percent), quantity
 * - Optional coupon (flat/percent), validated against total
 */
async function computeTotals({ attraction_id, addons = [], coupon_code = null, onDate = null }) {
  // Attraction base price
  const attraction = await attractionsModel.getAttractionById(attraction_id);
  if (!attraction) {
    const err = new Error('Attraction not found');
    err.status = 404;
    throw err;
  }
  const base = Number(attraction.base_price || 0);

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
 */
async function createBooking({
  user_id = null,
  attraction_id,
  slot_id = null,
  addons = [],
  coupon_code = null,
  payment_mode = 'Online',
  booking_date = null, // 'YYYY-MM-DD'
}) {
  const onDate = booking_date || new Date().toISOString().slice(0, 10);
  const totals = await computeTotals({ attraction_id, addons, coupon_code, onDate });

  return withTransaction(async (client) => {
    // Slot concurrency-safe capacity check (if applicable)
    if (slot_id) {
      await assertCapacityAndLock(client, slot_id);
    }

    // Insert booking
    const ins = await client.query(
      `INSERT INTO bookings
         (user_id, attraction_id, slot_id, total_amount, discount_amount, payment_mode, booking_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date)
       RETURNING *`,
      [
        user_id,
        attraction_id,
        slot_id,
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

  return { redirectUrl, tranCtx, response: raw };
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
  }

  return { success, response: raw };
}

module.exports = {
  // core
  computeTotals,
  createBooking,
  cancelBooking,

  // PayPhi
  initiatePayPhiPayment,
  checkPayPhiStatus,
};