// services/bookingService.js
const { withTransaction, pool } = require('../config/db');
const bookingsModel = require('../models/bookings.model');
const attractionsModel = require('../models/attractions.model');
const addonsModel = require('../models/addons.model');
const couponsModel = require('../models/coupons.model');
const combosModel = require('../models/combos.model');
const attractionSlotsModel = require('../models/attractionSlots.model');
let offersModel = null;
try { offersModel = require('../models/offers.model'); } catch (_) {}

const { createOrder: rzpCreate, verifyPaymentSignature } = require('../config/razorpay');
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

  const { discount: offerDisc } = await discountFromOffer(item.offer_id, preDiscount, onDate);
  
  const discount_amount = offerDisc;
  const total_amount = preDiscount; // Gross
  const final_amount = Math.max(0, total_amount - discount_amount); // Net

  return {
    quantity: qty,
    booking_date: onDate,
    total_amount,   // Gross
    discount_amount,
    final_amount,   // Net
    addons: normalized
  };
}

// -------- Totals (Multi - Helper) --------
async function computeTotalsMulti(items = []) {
  const out = [];
  for (const it of items) out.push(await computeTotals(it || {}));
  return out;
}

// -------- Capacity lock --------
async function lockCapacityIfNeeded(client, item) {
  const item_type = item.item_type || (item.combo_id ? 'Combo' : 'Attraction');
  if (item_type === 'Attraction' && item.slot_id && attractionSlotsModel?.assertCapacityAndLock) {
    await attractionSlotsModel.assertCapacityAndLock(client, item.slot_id);
  }
}

// -------- Create (Multi-Item Order) --------
async function createBookings(payload) {
  const items = Array.isArray(payload) ? payload : [payload];
  if (!items.length) {
    const e = new Error('No items provided'); e.status = 400; throw e;
  }

  // 1. Compute totals for all items
  let grandTotalGross = 0;
  let grandTotalDiscount = 0;
  
  const processedItems = [];
  const globalCouponCode = items[0]?.coupon_code || null; // Assume single coupon for cart
  const userId = items[0]?.user_id || null;
  const onDate = items[0]?.booking_date || new Date().toISOString().slice(0, 10);

  // Pre-calculation loop
  for (const item of items) {
      const lineTotals = await computeTotals(item);
      grandTotalGross += lineTotals.final_amount; // Sum of (Gross - ItemDiscount)
      processedItems.push({ ...item, ...lineTotals });
  }

  // 2. Apply Global Cart Coupon
  if (globalCouponCode) {
      const { discount } = await discountFromCoupon(globalCouponCode, grandTotalGross, onDate);
      grandTotalDiscount += discount;
  }

  // 3. Perform DB Transaction
  return withTransaction(async (client) => {
      // A. Create Parent Order
      const orderRes = await client.query(
          `INSERT INTO orders 
           (user_id, total_amount, discount_amount, payment_mode, coupon_code, payment_status)
           VALUES ($1, $2, $3, 'Online', $4, 'Pending')
           RETURNING *`,
           [userId, grandTotalGross, grandTotalDiscount, globalCouponCode]
      );
      const order = orderRes.rows[0];
      const orderId = order.order_id;

      // B. Create Child Bookings
      const bookings = [];
      
      for (const pItem of processedItems) {
          await lockCapacityIfNeeded(client, pItem);

          const isCombo = pItem.item_type === 'Combo' || (pItem.combo_id && !pItem.attraction_id);
          const itemType = isCombo ? 'Combo' : 'Attraction';
          
          // Strict ID assignment
          const attractionId = isCombo ? null : (pItem.attraction_id || null);
          const comboId = isCombo ? (pItem.combo_id || null) : null;
          const slotId = isCombo ? null : (pItem.slot_id || null);
          
          const bRes = await client.query(
              `INSERT INTO bookings 
               (order_id, user_id, item_type, attraction_id, combo_id, slot_id, 
                offer_id, quantity, booking_date, total_amount, payment_status)
               VALUES ($1, $2, $3::booking_item_type, $4, $5, $6, $7, $8, $9, $10, 'Pending')
               RETURNING *`,
               [
                   orderId, userId, itemType, attractionId, comboId, slotId, 
                   pItem.offer_id || null, pItem.quantity, pItem.booking_date, 
                   pItem.final_amount
               ]
          );
          const booking = bRes.rows[0];

          // Insert Addons
          for (const a of pItem.addons) {
              await client.query(
                  `INSERT INTO booking_addons (booking_id, addon_id, quantity, price)
                   VALUES ($1, $2, $3, $4)`,
                  [booking.booking_id, a.addon_id, a.quantity, a.price]
              );
          }
          bookings.push(booking);
      }

      return { order_id: orderId, order, bookings };
  });
}

// Legacy alias
const createBooking = createBookings; 

// -------- Payment & Status --------

async function initiatePayPhiPayment({ bookingId, email, mobile }) {
  // mapping param: bookingId -> orderId
  const orderId = bookingId; 
  
  const orderRes = await pool.query(`SELECT * FROM orders WHERE order_id = $1`, [orderId]);
  if (!orderRes.rows.length) { const e = new Error('Order not found'); e.status = 404; throw e; }
  const order = orderRes.rows[0];

  if (order.payment_status === 'Completed') {
    const e = new Error('Payment already completed'); e.status = 400; throw e;
  }
  
  const merchantTxnNo = order.order_ref;
  const amount = order.final_amount;

  const { redirectUrl, tranCtx, raw } = await payphiService.initiate({
    merchantTxnNo,
    amount,
    customerEmailID: email,
    customerMobileNo: mobile,
    addlParam1: String(orderId),
    addlParam2: 'GroupOrder'
  });

  if (tranCtx) {
    await pool.query(`UPDATE orders SET payment_ref = $1 WHERE order_id = $2`, [tranCtx, orderId]);
  }

  const responseCode = raw?.responseCode || raw?.respCode || raw?.code || raw?.response?.responseCode || null;
  const responseMessage = raw?.responseMessage || raw?.respMessage || raw?.message || raw?.response?.responseMessage || null;

  return { redirectUrl, tranCtx, responseCode, responseMessage, response: raw };
}

async function checkPayPhiStatus(orderId) {
  const orderRes = await pool.query(`SELECT * FROM orders WHERE order_id = $1`, [orderId]);
  if (!orderRes.rows.length) { const e = new Error('Order not found'); e.status = 404; throw e; }
  const order = orderRes.rows[0];

  const merchantTxnNo = order.order_ref;
  const originalTxnNo = order.order_ref;

  const { success, raw } = await payphiService.status({
    merchantTxnNo, originalTxnNo, amount: order.final_amount
  });

  if (success && order.payment_status !== 'Completed') {
    const txnId = raw?.transactionId || raw?.data?.transactionId || order.payment_ref;
    // Update Order
    await pool.query(`UPDATE orders SET payment_status = 'Completed', payment_ref = $1, updated_at = NOW() WHERE order_id = $2`, [txnId, order.order_id]);
    
    // Update Bookings
    await pool.query(`UPDATE bookings SET payment_status = 'Completed', payment_ref = $1, updated_at = NOW() WHERE order_id = $2`, [txnId, order.order_id]);

    // Generate Tickets
    const bookingsRes = await pool.query(`SELECT booking_id FROM bookings WHERE order_id = $1`, [order.order_id]);
    for (const row of bookingsRes.rows) {
        try {
            const urlPath = await ticketService.generateTicket(row.booking_id);
            await pool.query(`UPDATE bookings SET ticket_pdf = $1 WHERE booking_id = $2`, [urlPath, row.booking_id]);
            ticketEmailService.sendTicketEmail(row.booking_id).catch(err => console.error('Email failed', err.message));
        } catch (err) { console.error(`Failed to generate ticket ${row.booking_id}`, err); }
    }
 
  }try {
    await ticketEmailService.sendOrderEmail(order.order_id);
} catch (err) {
    console.error('Failed to send order email', err);
}


  return { success, response: raw };
}

// -------- Cancellation --------
async function cancelBooking(id) {
  return bookingsModel.cancelOrder(id);
}

module.exports = {
  computeTotals,
  computeTotalsMulti,
  createBooking,
  createBookings,
  cancelBooking,
  initiatePayPhiPayment,
  checkPayPhiStatus,
  createRazorpayOrder: async () => { throw new Error('Razorpay not migrated'); },
  verifyRazorpayPayment: async () => { throw new Error('Razorpay not migrated'); },
  initiatePhonePePayment: async () => { throw new Error('PhonePe not migrated'); },
  checkPhonePeStatus: async () => { throw new Error('PhonePe not migrated'); },
};