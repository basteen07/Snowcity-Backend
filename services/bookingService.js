// services/bookingService.js
const { withTransaction } = require('../config/db');
const bookingsModel = require('../models/bookings.model');
const attractionsModel = require('../models/attractions.model');
const addonsModel = require('../models/addons.model');
const couponsModel = require('../models/coupons.model');
const combosModel = require('../models/combos.model');
const attractionSlotsModel = require('../models/attractionSlots.model');
let offersModel = null;
try { offersModel = require('../models/offers.model'); } catch (_) {}

const { createOrder, verifyPaymentSignature } = require('../config/razorpay');
const phonepe = require('../config/phonepe');
const payphiService = require('./payphiService');
const ticketService = require('./ticketService');
const ticketEmailService = require('./ticketEmailService');

const toNumber = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);

// -------- Pricing helpers --------
async function priceFromAttraction(attraction_id) {
  const a = await attractionsModel.getAttractionById(attraction_id);
  if (!a) { const e = new Error('Attraction not found'); e.status = 404; throw e; }
  return { base: toNumber(a.base_price ?? a.price ?? a.amount, 0) };
}
async function priceFromAttractionSlot(slot_id) {
  if (!slot_id || !attractionSlotsModel?.getSlotById) return { slotPrice: null };
  try {
    const s = await attractionSlotsModel.getSlotById(slot_id);
    return { slotPrice: toNumber(s?.price ?? s?.amount, null) };
  } catch { return { slotPrice: null }; }
}
async function priceFromCombo(combo_id) {
  const c = await combosModel.getComboById(combo_id);
  if (!c) { const e = new Error('Combo not found'); e.status = 404; throw e; }
  return {
    base: toNumber(c.combo_price ?? c.price ?? c.amount, 0),
    combo: c
  };
}
async function normalizeAddons(addons = []) {
  let addonsTotal = 0;
  const normalized = [];
  for (const a of addons) {
    if (!a || a.addon_id == null) continue;
    const row = await addonsModel.getAddonById(a.addon_id);
    if (!row) continue;
    const qty = Math.max(1, toNumber(a.quantity ?? a.qty, 1));
    const unitBase = toNumber(row.price ?? row.amount, 0);
    const unit = unitBase * (1 - toNumber(row.discount_percent, 0) / 100);
    addonsTotal += unit * qty;
    normalized.push({ addon_id: row.addon_id, quantity: qty, price: unit });
  }
  return { addonsTotal, normalized };
}
async function discountFromCoupon(coupon_code, total, onDate) {
  if (!coupon_code) return { discount: 0, coupon: null };
  const coupon = await couponsModel.getCouponByCode(coupon_code, { activeOnly: true, onDate });
  const disc = await couponsModel.computeDiscount(coupon, total);
  return { discount: toNumber(disc?.discount ?? disc?.amount, 0), coupon };
}
async function discountFromOffer(offer_id, total, onDate) {
  if (!offer_id || !offersModel) return { discount: 0, offer: null };
  try {
    const offer = await offersModel.getOfferById(offer_id, { activeOnly: true, onDate });
    if (!offer) return { discount: 0, offer: null };
    const pct = toNumber(offer.discount_percent ?? offer.percent ?? offer.percentage, 0);
    const flat = toNumber(offer.flat_amount ?? offer.amount ?? offer.discount_amount, 0);
    const cap = toNumber(offer.max_discount ?? offer.maximum_discount ?? offer.cap, Infinity);
    let discount = 0;
    if (pct > 0) discount += (pct / 100) * total;
    discount += flat;
    return { discount: Math.min(discount, cap, total), offer };
  } catch { return { discount: 0, offer: null }; }
}

// -------- Totals (per item) --------
async function computeTotals(item = {}) {
  const item_type = item.item_type || (item.combo_id ? 'Combo' : 'Attraction');
  const qty = Math.max(1, toNumber(item.quantity ?? 1, 1));
  const onDate = item.booking_date || new Date().toISOString().slice(0, 10);

  let unit = 0;
  if (item_type === 'Combo') {
    const { base } = await priceFromCombo(item.combo_id);
    unit = base;
  } else {
    const { base } = await priceFromAttraction(item.attraction_id);
    const { slotPrice } = await priceFromAttractionSlot(item.slot_id);
    unit = slotPrice != null ? slotPrice : base;
  }

  const ticketsTotal = unit * qty;
  const { addonsTotal, normalized } = await normalizeAddons(item.addons || []);
  const preDiscount = ticketsTotal + addonsTotal;

  const { discount: couponDisc } = await discountFromCoupon(item.coupon_code, preDiscount, onDate);
  const { discount: offerDisc } = await discountFromOffer(item.offer_id, preDiscount, onDate);

  const discount_amount = Math.max(couponDisc, offerDisc); // use best of both by default
  const total_amount = preDiscount;
  const final_amount = Math.max(0, total_amount - discount_amount);

  return {
    quantity: qty,
    booking_date: onDate,
    total_amount,
    discount_amount,
    final_amount,
    addons: normalized
  };
}
async function computeTotalsMulti(items = []) {
  const out = [];
  for (const it of items) out.push(await computeTotals(it || {}));
  return out;
}

// -------- Capacity lock (attraction slots only in your schema) --------
async function lockCapacityIfNeeded(client, item) {
  const item_type = item.item_type || (item.combo_id ? 'Combo' : 'Attraction');
  if (item_type === 'Attraction' && item.slot_id && attractionSlotsModel?.assertCapacityAndLock) {
    await attractionSlotsModel.assertCapacityAndLock(client, item.slot_id);
  }
}

// -------- Create (single/multi) --------
async function createBooking(payload) {
  if (Array.isArray(payload)) return createBookings(payload);

  const item = payload || {};
  const item_type = item.item_type || (item.combo_id ? 'Combo' : 'Attraction');
  const totals = await computeTotals(item);

  // IMPORTANT: attraction_id is NOT NULL in your schema.
  // For Combo, we must set attraction_id to the primary attraction of the combo (attraction_1_id).
  let finalAttractionId = item.attraction_id || null;
  if (item_type === 'Combo') {
    const combo = await combosModel.getComboById(item.combo_id);
    if (!combo) { const e = new Error('Combo not found'); e.status = 404; throw e; }
    finalAttractionId = combo.attraction_1_id; // satisfy NOT NULL FK
  }

  return withTransaction(async (client) => {
    await lockCapacityIfNeeded(client, item);

    // Insert via model (enriched return)
    const created = await bookingsModel.createBooking({
      user_id: item.user_id || null,
      item_type,
      attraction_id: finalAttractionId,
      combo_id: item_type === 'Combo' ? item.combo_id : null,
      slot_id: item_type === 'Attraction' ? (item.slot_id || null) : null,
      // combo_slot_id intentionally omitted (no table in schema)
      offer_id: item.offer_id || null,

      quantity: totals.quantity,
      booking_date: totals.booking_date,
      total_amount: totals.total_amount,
      discount_amount: totals.discount_amount,
      payment_mode: item.payment_mode || 'Online'
    }, { client });

    // Persist add-ons snapshot
    for (const a of totals.addons) {
      await client.query(
        `INSERT INTO booking_addons (booking_id, addon_id, quantity, price)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (booking_id, addon_id) DO UPDATE
         SET quantity = EXCLUDED.quantity, price = EXCLUDED.price, updated_at = NOW()`,
        [created.booking_id, a.addon_id, a.quantity, a.price]
      );
    }

    return created;
  });
}

async function createBookings(items = []) {
  if (!Array.isArray(items) || !items.length) {
    const e = new Error('items array is required'); e.status = 400; throw e;
  }
  const totalsList = await computeTotalsMulti(items);

  return withTransaction(async (client) => {
    const results = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i] || {};
      const totals = totalsList[i];
      const item_type = item.item_type || (item.combo_id ? 'Combo' : 'Attraction');

      await lockCapacityIfNeeded(client, item);

      let finalAttractionId = item.attraction_id || null;
      if (item_type === 'Combo') {
        const combo = await combosModel.getComboById(item.combo_id);
        if (!combo) { const e = new Error('Combo not found'); e.status = 404; throw e; }
        finalAttractionId = combo.attraction_1_id; // satisfy NOT NULL FK
      }

      const created = await bookingsModel.createBooking({
        user_id: item.user_id || null,
        item_type,
        attraction_id: finalAttractionId,
        combo_id: item_type === 'Combo' ? item.combo_id : null,
        slot_id: item_type === 'Attraction' ? (item.slot_id || null) : null,
        offer_id: item.offer_id || null,

        quantity: totals.quantity,
        booking_date: totals.booking_date,
        total_amount: totals.total_amount,
        discount_amount: totals.discount_amount,
        payment_mode: item.payment_mode || 'Online'
      }, { client });

      for (const a of totals.addons) {
        await client.query(
          `INSERT INTO booking_addons (booking_id, addon_id, quantity, price)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (booking_id, addon_id) DO UPDATE
           SET quantity = EXCLUDED.quantity, price = EXCLUDED.price, updated_at = NOW()`,
          [created.booking_id, a.addon_id, a.quantity, a.price]
        );
      }

      results.push(created);
    }
    return results;
  });
}

// -------- Cancel/Payments/Tickets --------
async function cancelBooking(booking_id) {
  return bookingsModel.cancelBooking(booking_id);
}

async function createRazorpayOrder(booking_id) {
  const booking = await bookingsModel.getBookingById(booking_id);
  if (!booking) { const e = new Error('Booking not found'); e.status = 404; throw e; }
  if (booking.payment_status === 'Completed') {
    const e = new Error('Payment already completed'); e.status = 400; throw e;
  }
  const amount = Math.round(Number(booking.final_amount || 0) * 100);
  const order = await createOrder({
    amount, currency: 'INR', receipt: booking.booking_ref, notes: { booking_id: booking.booking_id }
  });
  return { order, booking };
}

async function verifyRazorpayPayment({ booking_id, order_id, payment_id, signature }) {
  const ok = verifyPaymentSignature({ orderId: order_id, paymentId: payment_id, signature });
  if (!ok) { const e = new Error('Invalid Razorpay signature'); e.status = 400; throw e; }
  const updated = await bookingsModel.setPayment(booking_id, {
    payment_status: 'Completed', payment_ref: payment_id
  });
  return updated;
}

async function initiatePhonePePayment(booking_id, { mobileNumber }) {
  const booking = await bookingsModel.getBookingById(booking_id);
  if (!booking) { const e = new Error('Booking not found'); e.status = 404; throw e; }
  const amount = Math.round(Number(booking.final_amount || 0) * 100);
  const merchantTransactionId = booking.booking_ref;
  const data = await phonepe.initiatePayment({
    merchantTransactionId, amount, mobileNumber, callbackUrl: process.env.PHONEPE_CALLBACK_URL
  });
  return { data, booking };
}

async function checkPhonePeStatus(booking_id) {
  const booking = await bookingsModel.getBookingById(booking_id);
  if (!booking) { const e = new Error('Booking not found'); e.status = 404; throw e; }
  const merchantTransactionId = booking.booking_ref;
  const statusResp = await phonepe.checkStatus(merchantTransactionId);
  const code = (statusResp?.code || '').toUpperCase();
  if (code === 'SUCCESS' || statusResp?.success === true) {
    if (booking.payment_status !== 'Completed') {
      await bookingsModel.setPayment(booking.booking_id, {
        payment_status: 'Completed',
        payment_ref: statusResp?.data?.transactionId || merchantTransactionId
      });
    }
  }
  return statusResp;
}

async function initiatePayPhiPayment(booking_id, { email, mobile, addlParam1 = '', addlParam2 = '' } = {}) {
  const booking = await bookingsModel.getBookingById(booking_id);
  if (!booking) { const e = new Error('Booking not found'); e.status = 404; throw e; }
  if (booking.payment_status === 'Completed') {
    const e = new Error('Payment already completed'); e.status = 400; throw e;
  }
  const merchantTxnNo = booking.booking_ref;
  const amount = booking.final_amount;

  const { redirectUrl, tranCtx, raw } = await payphiService.initiate({
    merchantTxnNo,
    amount,
    customerEmailID: email,
    customerMobileNo: mobile,
    addlParam1: addlParam1 || String(booking.booking_id),
    addlParam2
  });

  if (tranCtx) {
    await bookingsModel.updateBooking(booking.booking_id, { payment_ref: tranCtx });
  }

  const responseCode = raw?.responseCode || raw?.respCode || raw?.code || raw?.response?.responseCode || null;
  const responseMessage = raw?.responseMessage || raw?.respMessage || raw?.message || raw?.response?.responseMessage || null;

  return { redirectUrl, tranCtx, responseCode, responseMessage, response: raw };
}

async function checkPayPhiStatus(booking_id) {
  const booking = await bookingsModel.getBookingById(booking_id);
  if (!booking) { const e = new Error('Booking not found'); e.status = 404; throw e; }
  const merchantTxnNo = booking.booking_ref;
  const originalTxnNo = booking.booking_ref;

  const { success, raw } = await payphiService.status({
    merchantTxnNo, originalTxnNo, amount: booking.final_amount
  });

  if (success && booking.payment_status !== 'Completed') {
    await bookingsModel.setPayment(booking.booking_id, {
      payment_status: 'Completed',
      payment_ref: raw?.transactionId || raw?.data?.transactionId || booking.payment_ref
    });
    try {
      const urlPath = await ticketService.generateTicket(booking.booking_id);
      await bookingsModel.updateBooking(booking.booking_id, { ticket_pdf: urlPath });
      try { await ticketEmailService.sendTicketEmail(booking.booking_id); } catch (_) {}
    } catch (_) {}
  }

  return { success, response: raw };
}

module.exports = {
  computeTotals,
  computeTotalsMulti,
  createBooking,
  createBookings,
  cancelBooking,
  createRazorpayOrder,
  verifyRazorpayPayment,
  initiatePhonePePayment,
  checkPhonePeStatus,
  initiatePayPhiPayment,
  checkPayPhiStatus
};