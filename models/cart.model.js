// models/cart.model.js
const { pool } = require('../config/db');

function num(v, fallback = 0) {
  if (v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

function mapCart(row) {
  if (!row) return null;
  return {
    cart_id: row.cart_id,
    cart_ref: row.cart_ref,
    user_id: row.user_id,
    session_id: row.session_id,
    total_amount: num(row.total_amount, 0),
    discount_amount: num(row.discount_amount, 0),
    final_amount: num(row.final_amount, 0),
    payment_status: row.payment_status,
    payment_mode: row.payment_mode,
    payment_txn_no: row.payment_txn_no || null, // may not exist in all DBs
    payment_ref: row.payment_ref,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCartItem(row) {
  if (!row) return null;
  const quantity = num(row.quantity, 1);
  const unit_price = num(row.unit_price, 0);
  return {
    cart_item_id: row.cart_item_id,
    cart_id: row.cart_id,
    item_type: row.item_type,
    attraction_id: row.attraction_id,
    combo_id: row.combo_id,
    offer_id: row.offer_id,
    combo_slot_id: row.combo_slot_id, // may be undefined if column doesn’t exist
    slot_id: row.slot_id,
    booking_date: row.booking_date,
    booking_time: row.booking_time,
    quantity,
    unit_price,
    total_amount: num(row.total_amount, quantity * unit_price),
    meta: row.meta,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getCartById(cart_id) {
  const { rows } = await pool.query('SELECT * FROM carts WHERE cart_id = $1', [cart_id]);
  return mapCart(rows[0]);
}

async function getCartByRef(cart_ref) {
  const { rows } = await pool.query('SELECT * FROM carts WHERE cart_ref = $1', [cart_ref]);
  return mapCart(rows[0]);
}

async function getOpenCart({ user_id = null, session_id = null }) {
  const clauses = ['status = $1', 'payment_status = $2'];
  const params = ['Open', 'Pending'];
  let i = 3;

  if (user_id) {
    clauses.push(`user_id = $${i++}`);
    params.push(user_id);
  } else if (session_id) {
    clauses.push(`session_id = $${i++}`);
    params.push(session_id);
  } else {
    return null;
  }

  const sql = `SELECT * FROM carts WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC LIMIT 1`;
  const { rows } = await pool.query(sql, params);
  return mapCart(rows[0]);
}

async function createCart({ user_id = null, session_id = null, payment_mode = 'Online' }) {
  const { rows } = await pool.query(
    'INSERT INTO carts (user_id, session_id, payment_mode) VALUES ($1, $2, $3) RETURNING *',
    [user_id, session_id, payment_mode]
  );
  return mapCart(rows[0]);
}

async function upsertOpenCart({ user_id = null, session_id = null, payment_mode = 'Online' }) {
  const existing = await getOpenCart({ user_id, session_id });
  if (existing) return existing;
  return createCart({ user_id, session_id, payment_mode });
}

async function listItems(cart_id) {
  const { rows } = await pool.query(
    'SELECT * FROM cart_items WHERE cart_id = $1 ORDER BY created_at ASC',
    [cart_id]
  );
  return rows.map(mapCartItem);
}

// Attempt insert with combo_slot_id; if column doesn't exist, fallback without it
async function addItem(
  cart_id,
  {
    item_type,
    attraction_id = null,
    combo_id = null,
    offer_id = null,
    slot_id = null,
    combo_slot_id = null,
    booking_date = null,
    booking_time = null,
    quantity = 1,
    unit_price = 0,
    meta = {},
  }
) {
  const payloadJson = JSON.stringify(meta || {});
  const sqlWithComboSlot = `
    INSERT INTO cart_items
      (cart_id, item_type, attraction_id, combo_id, offer_id, slot_id, combo_slot_id, booking_date, booking_time, quantity, unit_price, meta)
    VALUES
      ($1,      $2,        $3,           $4,       $5,       $6,      $7,            $8::date,     $9::time,     $10,      $11,       COALESCE($12::jsonb, '{}'::jsonb))
    RETURNING *`;
  const paramsWith = [
    cart_id,
    item_type,
    attraction_id,
    combo_id,
    offer_id,
    slot_id,
    combo_slot_id,
    booking_date,
    booking_time,
    quantity,
    unit_price,
    payloadJson,
  ];

  try {
    const { rows } = await pool.query(sqlWithComboSlot, paramsWith);
    return mapCartItem(rows[0]);
  } catch (err) {
    // 42703 = undefined_column -> fallback for environments without combo_slot_id
    if (err && err.code === '42703') {
      const sqlNoComboSlot = `
        INSERT INTO cart_items
          (cart_id, item_type, attraction_id, combo_id, offer_id, slot_id, booking_date, booking_time, quantity, unit_price, meta)
        VALUES
          ($1,      $2,        $3,           $4,       $5,       $6,     $7::date,     $8::time,     $9,       $10,      COALESCE($11::jsonb, '{}'::jsonb))
        RETURNING *`;
      const paramsNo = [
        cart_id,
        item_type,
        attraction_id,
        combo_id,
        offer_id,
        slot_id,
        booking_date,
        booking_time,
        quantity,
        unit_price,
        payloadJson,
      ];
      const { rows } = await pool.query(sqlNoComboSlot, paramsNo);
      return mapCartItem(rows[0]);
    }
    throw err;
  }
}

async function updateItem(cart_item_id, fields = {}) {
  const allowed = new Set([
    'item_type',
    'attraction_id',
    'combo_id',
    'offer_id',
    'combo_slot_id',
    'slot_id',
    'booking_date',
    'booking_time',
    'quantity',
    'unit_price',
    'meta',
  ]);
  const entries = Object.entries(fields).filter(([k, v]) => allowed.has(k) && v !== undefined);

  if (!entries.length) {
    const { rows } = await pool.query('SELECT * FROM cart_items WHERE cart_item_id = $1', [cart_item_id]);
    return mapCartItem(rows[0]);
  }

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    const cast = k === 'booking_date' ? '::date' : k === 'booking_time' ? '::time' : k === 'meta' ? '::jsonb' : '';
    sets.push(`${k} = $${idx + 1}${cast}`);
    params.push(k === 'meta' ? JSON.stringify(v) : v);
  });
  params.push(cart_item_id);

  const { rows } = await pool.query(
    `UPDATE cart_items SET ${sets.join(', ')}, updated_at = NOW() WHERE cart_item_id = $${params.length} RETURNING *`,
    params
  );
  return mapCartItem(rows[0]);
}

async function removeItem(cart_item_id) {
  const { rowCount } = await pool.query('DELETE FROM cart_items WHERE cart_item_id = $1', [cart_item_id]);
  return rowCount > 0;
}

async function clearCart(cart_id) {
  await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cart_id]);
}

// Recompute totals from items; clamp discount_amount to avoid violating CHECK (discount <= total)
async function recomputeTotals(cart_id) {
  const { rows: sumRows } = await pool.query(
    `SELECT COALESCE(SUM(quantity * unit_price), 0)::numeric(10,2) AS t FROM cart_items WHERE cart_id = $1`,
    [cart_id]
  );
  const sum = sumRows[0]?.t || 0;

  const { rows } = await pool.query(
    `UPDATE carts
       SET total_amount = $2,
           discount_amount = LEAST(discount_amount, $2),
           updated_at = NOW()
     WHERE cart_id = $1
     RETURNING *`,
    [cart_id, sum]
  );
  return mapCart(rows[0]);
}

async function setPayment(cart_id, { payment_status, payment_ref = null, payment_txn_no = undefined }) {
  if (payment_txn_no !== undefined) {
    try {
      const { rows } = await pool.query(
        `UPDATE carts
           SET payment_status = $2,
               payment_ref = COALESCE($3, payment_ref),
               payment_txn_no = COALESCE($4, payment_txn_no),
               updated_at = NOW()
         WHERE cart_id = $1
         RETURNING *`,
        [cart_id, payment_status, payment_ref, payment_txn_no]
      );
      return mapCart(rows[0]);
    } catch (e) {
      // 42703 = undefined_column -> fallback if payment_txn_no not present in this DB
      if (e.code !== '42703') throw e;
    }
  }
  const { rows } = await pool.query(
    `UPDATE carts
       SET payment_status = $2,
           payment_ref = COALESCE($3, payment_ref),
           updated_at = NOW()
     WHERE cart_id = $1
     RETURNING *`,
    [cart_id, payment_status, payment_ref]
  );
  return mapCart(rows[0]);
}

async function setStatus(cart_id, status) {
  const { rows } = await pool.query(
    `UPDATE carts SET status = $2, updated_at = NOW() WHERE cart_id = $1 RETURNING *`,
    [cart_id, status]
  );
  return mapCart(rows[0]);
}

module.exports = {
  mapCart,
  mapCartItem,
  getCartById,
  getCartByRef,
  getOpenCart,
  createCart,
  upsertOpenCart,
  listItems,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  recomputeTotals,
  setPayment,
  setStatus,
};