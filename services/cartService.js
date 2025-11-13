const { withTransaction } = require('../config/db');
const cartModel = require('../models/cart.model');
const attractionsModel = require('../models/attractions.model');
const combosModel = require('../models/combos.model');
const comboSlotsModel = require('../models/comboSlots.model');
const { getSlotById, assertCapacityAndLock } = require('../models/attractionSlots.model');
const bookingsModel = require('../models/bookings.model');
const bookingService = require('./bookingService');
const payphiService = require('./payphiService');
const payphi = require('../config/payphi');

async function getOrCreateCart({ user_id = null, session_id = null, payment_mode = 'Online' }) {
  return cartModel.upsertOpenCart({ user_id, session_id, payment_mode });
}

async function getCartWithItems(cart) {
  if (!cart) return { cart: null, items: [] };
  const items = await cartModel.listItems(cart.cart_id);
  return { cart, items };
}

async function resolveAttractionUnitPrice({ attraction_id, slot_id = null }) {
  const attraction = await attractionsModel.getAttractionById(attraction_id);
  if (!attraction) {
    const err = new Error('Attraction not found');
    err.status = 404;
    throw err;
  }
  let unit = Number(attraction.base_price || 0);
  if (slot_id) {
    const slot = await getSlotById(slot_id);
    if (slot && slot.price != null) unit = Number(slot.price);
  }
  return { unit, attraction };
}

async function resolveComboUnitPrice({ combo_id, combo_slot_id = null }) {
  const combo = await combosModel.getComboById(combo_id);
  if (!combo) {
    const err = new Error('Combo not found');
    err.status = 404;
    throw err;
  }
  let unit = Number(combo.combo_price || 0);
  if (combo_slot_id) {
    const slot = await comboSlotsModel.getSlotById(combo_slot_id);
    if (!slot || slot.combo_id !== combo.combo_id) {
      const err = new Error('Combo slot not found for combo');
      err.status = 404;
      throw err;
    }
    if (slot.price != null) unit = Number(slot.price);
    if (slot.available === false) {
      const err = new Error('Combo slot not available');
      err.status = 409;
      throw err;
    }
  }
  return { unit, combo };
}

async function addItem({ user_id = null, session_id = null, item }) {
  const cart = await getOrCreateCart({ user_id, session_id });
  const {
    attraction_id = null,
    combo_id = null,
    slot_id = null,
    combo_slot_id = null,
    booking_date = null,
    booking_time = null,
    quantity = 1,
    item_type = 'attraction',
    meta = {},
  } = item || {};

  const qty = Math.max(1, Number(quantity || 1));

  let unit = 0;
  if (item_type === 'attraction') {
    if (!attraction_id) {
      const err = new Error('attraction_id is required');
      err.status = 400;
      throw err;
    }
    const resolved = await resolveAttractionUnitPrice({ attraction_id, slot_id });
    unit = resolved.unit;
  } else if (item_type === 'combo') {
    if (!combo_id) {
      const err = new Error('combo_id is required');
      err.status = 400;
      throw err;
    }
    const resolved = await resolveComboUnitPrice({ combo_id, combo_slot_id });
    unit = resolved.unit;
  } else {
    const err = new Error('Unsupported item_type');
    err.status = 400;
    throw err;
  }

  const cartItem = await cartModel.addItem(cart.cart_id, {
    item_type,
    attraction_id,
    combo_id,
    slot_id,
    combo_slot_id,
    booking_date,
    booking_time,
    quantity: qty,
    unit_price: unit,
    meta,
  });
  const updatedCart = await cartModel.recomputeTotals(cart.cart_id);
  const items = await cartModel.listItems(cart.cart_id);
  return { cart: updatedCart, items, added: cartItem };
}

async function updateItem({ user_id = null, session_id = null, cart_item_id, fields }) {
  const cart = await cartModel.getOpenCart({ user_id, session_id });
  if (!cart) {
    const err = new Error('Open cart not found');
    err.status = 404;
    throw err;
  }
  const row = await cartModel.updateItem(cart_item_id, fields);
  const updatedCart = await cartModel.recomputeTotals(cart.cart_id);
  const items = await cartModel.listItems(cart.cart_id);
  return { cart: updatedCart, items, updated: row };
}

async function removeItem({ user_id = null, session_id = null, cart_item_id }) {
  const cart = await cartModel.getOpenCart({ user_id, session_id });
  if (!cart) {
    const err = new Error('Open cart not found');
    err.status = 404;
    throw err;
  }
  await cartModel.removeItem(cart_item_id);
  const updatedCart = await cartModel.recomputeTotals(cart.cart_id);
  const items = await cartModel.listItems(cart.cart_id);
  return { cart: updatedCart, items };
}

async function initiatePayPhi({ user_id = null, session_id = null, email, mobile }) {
  const cart = await cartModel.getOpenCart({ user_id, session_id });
  if (!cart) {
    const err = new Error('Open cart not found');
    err.status = 404;
    throw err;
  }
  const items = await cartModel.listItems(cart.cart_id);
  if (!items.length) {
    const err = new Error('Cart is empty');
    err.status = 400;
    throw err;
  }
  const amount = Number(cart.final_amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error('Cart total must be greater than zero');
    err.status = 400;
    throw err;
  }
  // Build a unique merchantTxnNo per attempt to avoid PayPhi P1006 (duplicate reference)
  const baseTxn = String(cart.cart_ref || `CART${cart.cart_id}`);
  const timeSuffix = payphi.formatTxnDate().slice(-5); // last 5 digits from UTC timestamp
  const rand2 = String(Math.floor(Math.random() * 90) + 10); // 2-digit random
  const merchantTxnNo = `${baseTxn}${timeSuffix}${rand2}`;
  const emailTrim = String(email || '').trim();
  const mobileDigits = String(mobile || '').replace(/\D/g, '');
  const normalizedMobile = mobileDigits.length >= 10 ? mobileDigits.slice(-10) : mobileDigits;
  const { redirectUrl, tranCtx, raw } = await payphiService.initiate({
    merchantTxnNo,
    amount,
    customerEmailID: emailTrim,
    customerMobileNo: normalizedMobile,
    addlParam1: String(cart.cart_id),
    addlParam2: 'SnowCityCart',
  });
  if (tranCtx) {
    await cartModel.setPayment(cart.cart_id, { payment_status: 'Pending', payment_ref: tranCtx, payment_txn_no: merchantTxnNo });
  }
  return { redirectUrl, tranCtx, response: raw };
}

async function createBookingsFromCart(cart_id, user_id) {
  const cart = await cartModel.getCartById(cart_id);
  if (!cart) {
    const err = new Error('Cart not found');
    err.status = 404;
    throw err;
  }
  const items = await cartModel.listItems(cart_id);
  const bookings = [];
  for (const it of items) {
    let b;
    if (it.item_type === 'combo') {
      b = await bookingService.createComboBooking({
        user_id,
        combo_id: it.combo_id,
        combo_slot_id: it.combo_slot_id,
        quantity: it.quantity,
        booking_date: it.booking_date,
        booking_time: it.booking_time,
        payment_mode: cart.payment_mode,
      });
    } else {
      b = await bookingService.createBooking({
        user_id,
        attraction_id: it.attraction_id,
        slot_id: it.slot_id,
        quantity: it.quantity,
        booking_date: it.booking_date,
        booking_time: it.booking_time,
        payment_mode: cart.payment_mode,
      });
    }
    await bookingsModel.setPayment(b.booking_id, { payment_status: 'Completed', payment_ref: cart.payment_ref });
    bookings.push(b);
  }
  return bookings;
}

module.exports = {
  getOrCreateCart,
  getCartWithItems,
  addItem,
  updateItem,
  removeItem,
  initiatePayPhi,
  createBookingsFromCart,
};
