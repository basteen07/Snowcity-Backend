// services/bookingService.js
const { withTransaction, pool } = require('../config/db');
const bookingsModel = require('../models/bookings.model');
const attractionsModel = require('../models/attractions.model');
const addonsModel = require('../models/addons.model');
const couponsModel = require('../models/coupons.model');
const combosModel = require('../models/combos.model');
const attractionSlotsModel = require('../models/attractionSlots.model');
const comboSlotsModel = require('../models/comboSlots.model');
let offersModel = null;
try { offersModel = require('../models/offers.model'); } catch (_) {}

const { createOrder: rzpCreate, verifyPaymentSignature } = require('../config/razorpay');
const phonepe = require('../config/phonepe');
const payphiService = require('./payphiService');
const ticketService = require('./ticketService');
const ticketEmailService = require('./ticketEmailService');

const toNumber = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);

async function applyOfferPricing({
  targetType,
  targetId,
  slotType = null,
  slotId = null,
  baseAmount = 0,
  booking_date = null,
  booking_time = null,
}) {
  const base = toNumber(baseAmount, 0);
  if (!offersModel?.findApplicableOfferRule || !targetType || !targetId) {
    return { unit: base, discount: 0, offer: null };
  }

  const match = await offersModel.findApplicableOfferRule({
    targetType,
    targetId,
    slotType,
    slotId,
    date: booking_date,
    time: booking_time,
  });
  if (!match) return { unit: base, discount: 0, offer: null };

  const { offer, rule } = match;
  let discountType = rule?.rule_discount_type || offer.discount_type || (offer.discount_percent ? 'percent' : null);
  let discountValue = rule?.rule_discount_value ?? offer.discount_value ?? offer.discount_percent ?? 0;
  if (!discountType || !discountValue) {
    return { unit: base, discount: 0, offer: null };
  }

  discountType = String(discountType).toLowerCase();
  let discount = discountType === 'amount'
    ? Number(discountValue)
    : (Number(discountValue) / 100) * base;

  if (offer.max_discount != null) {
    discount = Math.min(discount, Number(offer.max_discount));
  }
  discount = Math.min(discount, base);

  const finalUnit = toNumber(base - discount, 0);
  return {
    unit: finalUnit,
    discount: toNumber(discount, 0),
    offer: {
      offer_id: offer.offer_id,
      rule_id: rule.rule_id,
      title: offer.title,
      discount_type: discountType,
      discount_value: Number(discountValue),
    },
  };
}

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
// -------- Totals (per item) --------
async function computeTotals(item = {}) {
  const item_type = item.item_type || (item.combo_id ? 'Combo' : 'Attraction');
  const qty = Math.max(1, toNumber(item.quantity ?? 1, 1));
  const onDate = item.booking_date || new Date().toISOString().slice(0, 10);

  let baseUnit = 0;
  let slotType = null;
  let slotId = null;
  if (item_type === 'Combo') {
    const { base } = await priceFromCombo(item.combo_id);
    baseUnit = base;
    if (item.combo_slot_id) {
      slotType = 'combo';
      slotId = item.combo_slot_id;
    }
  } else {
    const { base } = await priceFromAttraction(item.attraction_id);
    const { slotPrice } = await priceFromAttractionSlot(item.slot_id);
    baseUnit = slotPrice != null ? slotPrice : base;
    if (item.slot_id) {
      slotType = 'attraction';
      slotId = item.slot_id;
    }
  }

  const pricing = await applyOfferPricing({
    targetType: item_type === 'Combo' ? 'combo' : 'attraction',
    targetId: item_type === 'Combo' ? item.combo_id : item.attraction_id,
    slotType,
    slotId,
    baseAmount: baseUnit,
    booking_date: item.booking_date,
    booking_time: item.booking_time,
  });

  const unit = pricing.unit;
  const unitDiscount = pricing.discount;
  const ticketsTotal = unit * qty;
  const baseTicketsTotal = baseUnit * qty;
  const offerDiscountTotal = unitDiscount * qty;

  const { addonsTotal, normalized } = await normalizeAddons(item.addons || []);
  const preDiscount = baseTicketsTotal + addonsTotal;

  const discount_amount = offerDiscountTotal;
  const total_amount = preDiscount; // Gross
  const final_amount = Math.max(0, total_amount - discount_amount); // Net

  return {
    quantity: qty,
    booking_date: onDate,
    total_amount,   // Gross
    discount_amount,
    final_amount,   // Net
    addons: normalized,
    base_unit_price: baseUnit,
    unit_price: unit,
    unit_discount: unitDiscount,
    offer: pricing.offer,
    offer_id: pricing.offer?.offer_id || null,
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
  } else if (item_type === 'Combo' && item.combo_slot_id && comboSlotsModel?.assertCapacityAndLock) {
    await comboSlotsModel.assertCapacityAndLock(client, item.combo_slot_id);
  }
}

// -------- Create (Multi-Item Order) --------
async function createBookings(payload) {
  const items = Array.isArray(payload) ? payload : [payload];
  if (!items.length) {
    const e = new Error('No items provided'); e.status = 400; throw e;
  }

  // 1. Compute totals for all items
  let grossBeforeDiscount = 0;
  let offerDiscountTotal = 0;
  
  const processedItems = [];
  const globalCouponCode = items[0]?.coupon_code || null; // Assume single coupon for cart
  const userId = items[0]?.user_id || null;
  const onDate = items[0]?.booking_date || new Date().toISOString().slice(0, 10);

  // Pre-calculation loop
  for (const item of items) {
      const lineTotals = await computeTotals(item);
      grossBeforeDiscount += lineTotals.total_amount;
      offerDiscountTotal += lineTotals.discount_amount;
      processedItems.push({ ...item, ...lineTotals });
  }

  // 2. Apply Global Cart Coupon
  let couponDiscount = 0;
  if (globalCouponCode) {
      const { discount } = await discountFromCoupon(globalCouponCode, Math.max(grossBeforeDiscount - offerDiscountTotal, 0), onDate);
      couponDiscount = discount;
  }

  const grandTotalDiscount = offerDiscountTotal + couponDiscount;
  
  // 3. Perform DB Transaction
  return withTransaction(async (client) => {
      // A. Create Parent Order
      const orderRes = await client.query(
          `INSERT INTO orders 
           (user_id, total_amount, discount_amount, payment_mode, coupon_code, payment_status)
           VALUES ($1, $2, $3, 'Online', $4, 'Pending')
           RETURNING *`,
           [userId, grossBeforeDiscount, grandTotalDiscount, globalCouponCode]
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
          const comboSlotId = isCombo ? (pItem.combo_slot_id || null) : null;
          
          const bRes = await client.query(
              `INSERT INTO bookings 
               (order_id, user_id, item_type, attraction_id, combo_id, slot_id, combo_slot_id,
                offer_id, quantity, booking_date, total_amount, discount_amount, payment_status)
               VALUES ($1, $2, $3::booking_item_type, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Pending')
               RETURNING *`,
               [
                  orderId, userId, itemType, attractionId, comboId, slotId, comboSlotId,
                  pItem.offer_id || null, pItem.quantity, pItem.booking_date, 
                  pItem.total_amount, pItem.discount_amount
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
  const amount = order.final_amount ?? Math.max(0, Number(order.total_amount || 0) - Number(order.discount_amount || 0));
  if (!amount || Number(amount) <= 0) {
    const e = new Error('Order total must be greater than zero to initiate payment');
    e.status = 400;
    throw e;
  }

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
            await ticketEmailService.sendTicketEmail(row.booking_id);
        } catch (err) {
            console.error(`Ticket email workflow failed for booking ${row.booking_id}`, err);
        }
    }

    try {
        await ticketEmailService.sendOrderEmail(order.order_id);
    } catch (err) {
        console.error('Failed to send order email', err);
    }
 
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