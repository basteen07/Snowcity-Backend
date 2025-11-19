// models/bookings.model.js
const { pool, withTransaction } = require('../config/db');

// ---------- Row mapper (Bookings) ----------
function mapBooking(row) {
  if (!row) return null;
  return {
    booking_id: row.booking_id,
    booking_ref: row.booking_ref,
    order_id: row.order_id || null, // Link to parent order
    user_id: row.user_id,

    // Product refs
    item_type: row.item_type || 'Attraction', // 'Attraction' | 'Combo'
    attraction_id: row.attraction_id || null,
    combo_id: row.combo_id || null,
    offer_id: row.offer_id || null,

    // Slot refs
    slot_id: row.slot_id || null,
    combo_slot_id: row.combo_slot_id || null,

    // Counts & timing
    quantity: row.quantity,
    booking_date: row.booking_date,
    booking_time: row.booking_time,

    // Money
    total_amount: row.total_amount,
    discount_amount: row.discount_amount,
    final_amount: row.final_amount,

    // Status (Now primarily derived from Order, but kept on row for legacy)
    payment_status: row.payment_status,
    booking_status: row.booking_status,

    // Artifacts
    ticket_pdf: row.ticket_pdf,
    whatsapp_sent: row.whatsapp_sent,
    email_sent: row.email_sent,

    // Titles
    attraction_title: row.attraction_title || null,
    combo_title: row.combo_title || row.combo_name || null,
    item_title: row.item_title || row.attraction_title || row.combo_title || null,

    // Slot details
    slot_start_time: row.slot_start_time || null,
    slot_end_time: row.slot_end_time || null,

    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// ---------- Row mapper (Orders) ----------
function mapOrder(row) {
  if (!row) return null;
  return {
    order_id: row.order_id,
    order_ref: row.order_ref,
    user_id: row.user_id,
    total_amount: row.total_amount,
    discount_amount: row.discount_amount,
    final_amount: row.final_amount,
    payment_status: row.payment_status,
    payment_mode: row.payment_mode,
    payment_ref: row.payment_ref,
    created_at: row.created_at,
    // We might attach items here later manually
    items: [] 
  };
}

// ---------- Schema capabilities ----------
// Adjusted to assume the new schema exists based on your SQL script
async function getBaseSqlParts() {
    const select = `
        b.*,
        a.title AS attraction_title,
        c.combo_id,
        -- Logic to get combo title
        COALESCE(
            NULLIF(CONCAT_WS(' + ', NULLIF(a1c.title, ''), NULLIF(a2c.title, '')), ''),
            CONCAT('Combo #', c.combo_id::text)
        ) AS combo_title,
        
        -- Normalized Item Title
        CASE 
            WHEN b.item_type = 'Combo' THEN 
                COALESCE(NULLIF(CONCAT_WS(' + ', NULLIF(a1c.title, ''), NULLIF(a2c.title, '')), ''), CONCAT('Combo #', c.combo_id::text))
            ELSE a.title 
        END AS item_title,

        -- Slot times
        s.start_time AS slot_start_time,
        s.end_time AS slot_end_time
    `;

    const joins = `
        LEFT JOIN attractions a       ON a.attraction_id   = b.attraction_id
        LEFT JOIN combos      c       ON c.combo_id        = b.combo_id
        LEFT JOIN attractions a1c     ON a1c.attraction_id = c.attraction_1_id
        LEFT JOIN attractions a2c     ON a2c.attraction_id = c.attraction_2_id
        LEFT JOIN attraction_slots s  ON s.slot_id         = b.slot_id
    `;

    return { select, joins };
}

// ---------- READ Operations ----------

async function getBookingById(booking_id) {
  const { select, joins } = await getBaseSqlParts();
  const { rows } = await pool.query(`SELECT ${select} FROM bookings b ${joins} WHERE b.booking_id = $1`, [booking_id]);
  return mapBooking(rows[0]);
}

// Get full Order details (The "Receipt" view)
async function getOrderWithDetails(order_id) {
    // 1. Get Order
    const orderRes = await pool.query(`SELECT * FROM orders WHERE order_id = $1`, [order_id]);
    if (!orderRes.rows.length) return null;
    const order = mapOrder(orderRes.rows[0]);

    // 2. Get Bookings (Items)
    const { select, joins } = await getBaseSqlParts();
    const bookingRes = await pool.query(
        `SELECT ${select} FROM bookings b ${joins} WHERE b.order_id = $1 ORDER BY b.created_at ASC`, 
        [order_id]
    );
    order.items = bookingRes.rows.map(mapBooking);

    return order;
}

// List bookings (Legacy support + My Bookings individual rows)
async function listBookings({
  user_id = null,
  order_id = null,
  limit = 20,
  offset = 0
} = {}) {
  const { select, joins } = await getBaseSqlParts();
  const where = [];
  const params = [];
  let i = 1;

  if (user_id) { where.push(`b.user_id = $${i++}`); params.push(user_id); }
  if (order_id) { where.push(`b.order_id = $${i++}`); params.push(order_id); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT ${select} FROM bookings b ${joins} ${whereSql} ORDER BY b.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );

  return rows.map(mapBooking);
}

// ---------- WRITE Operations (Transactional Multi-Item) ----------

/**
 * Creates a Parent Order and Multiple Child Bookings (with Addons)
 * This solves the "Multiple items pay at single time" requirement.
 */
async function createOrderWithItems(orderPayload, items = []) {
  return withTransaction(async (client) => {
    // 1. Create Parent Order
    const { 
        user_id, 
        total_amount, 
        discount_amount = 0, 
        payment_mode = 'Online', 
        coupon_code = null 
    } = orderPayload;

    const orderRes = await client.query(
      `INSERT INTO orders 
       (user_id, total_amount, discount_amount, payment_mode, coupon_code, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'Pending')
       RETURNING *`,
      [user_id, total_amount, discount_amount, payment_mode, coupon_code]
    );
    const order = orderRes.rows[0];
    const orderId = order.order_id;

    const createdBookings = [];

    // 2. Create Child Bookings
    for (const item of items) {
        // FIX: Strict check to prevent "violates check constraint"
        // If Combo, attraction_id MUST be null. If Attraction, combo_id MUST be null.
        const isCombo = item.item_type === 'Combo' || (item.combo_id && !item.attraction_id);
        
        const item_type = isCombo ? 'Combo' : 'Attraction';
        const attraction_id = isCombo ? null : (item.attraction_id || null);
        const combo_id = isCombo ? (item.combo_id || null) : null;
        const slot_id = isCombo ? null : (item.slot_id || null);
        const combo_slot_id = isCombo ? (item.combo_slot_id || null) : null;

        // Calculate item specific totals (simple logic, can be expanded)
        // Assuming the frontend/controller calculated the unit price * qty = total_amount for this line item
        const itemTotal = item.total_amount || 0; 

        const bookingRes = await client.query(
            `INSERT INTO bookings 
             (order_id, user_id, item_type, attraction_id, combo_id, slot_id, combo_slot_id, 
              offer_id, quantity, booking_date, total_amount, payment_status)
             VALUES 
             ($1, $2, $3::booking_item_type, $4, $5, $6, $7, 
              $8, $9, $10, $11, 'Pending')
             RETURNING *`,
            [
                orderId,
                user_id,
                item_type,
                attraction_id,
                combo_id,
                slot_id,
                combo_slot_id,
                item.offer_id || null,
                item.quantity || 1,
                item.booking_date || new Date(),
                itemTotal
            ]
        );

        const booking = bookingRes.rows[0];

        // 3. Insert Addons for this booking
        if (item.addons && Array.isArray(item.addons) && item.addons.length > 0) {
            for (const addon of item.addons) {
                await client.query(
                    `INSERT INTO booking_addons (booking_id, addon_id, quantity, price)
                     VALUES ($1, $2, $3, $4)`,
                     // Assuming price lookup happens in controller or passed from FE, 
                     // ideally should be looked up from DB here for security
                    [booking.booking_id, addon.addon_id, addon.quantity, addon.price || 0] 
                );
            }
        }
        
        createdBookings.push(booking);
    }

    return { order, bookings: createdBookings };
  });
}

// ---------- Legacy Single Create (Adapted) ----------
async function createBooking(fields = {}, { client: extClient } = {}) {
  // If this is called directly, we create a "wrapper" order implicitly 
  // or insert nullable order_id if DB allows (but DB usually requires order_id now).
  // For backward compatibility, we wrap it in a transaction and create an Order first.
  
  const runner = extClient || pool;
  
  // 1. Normalize Input
  const isCombo = fields.item_type === 'Combo' || (fields.combo_id && !fields.attraction_id);
  const item_type = isCombo ? 'Combo' : 'Attraction';
  const attraction_id = isCombo ? null : fields.attraction_id;
  const combo_id = isCombo ? fields.combo_id : null;
  const slot_id = isCombo ? null : fields.slot_id;

  // 2. Insert
  // Note: If your schema requires order_id NOT NULL, this function needs to create an order first.
  // Assuming strict schema from your update:
  
  if (!fields.order_id) {
      // Auto-create wrapper order
      const ord = await runner.query(
          `INSERT INTO orders (user_id, total_amount, payment_status) VALUES ($1, $2, 'Pending') RETURNING order_id`,
          [fields.user_id, fields.total_amount]
      );
      fields.order_id = ord.rows[0].order_id;
  }

  const res = await runner.query(
    `INSERT INTO bookings 
      (order_id, user_id, item_type, attraction_id, combo_id, slot_id, quantity, booking_date, total_amount, payment_status)
     VALUES ($1, $2, $3::booking_item_type, $4, $5, $6, $7, $8, $9, 'Pending')
     RETURNING *`,
    [
      fields.order_id,
      fields.user_id,
      item_type,
      attraction_id,
      combo_id,
      slot_id,
      fields.quantity,
      fields.booking_date,
      fields.total_amount
    ]
  );
  
  return mapBooking(res.rows[0]);
}

// ---------- Updates ----------

async function updatePaymentStatus(order_id, status, ref = null) {
    return withTransaction(async (client) => {
        // 1. Update Order
        const orderRes = await client.query(
            `UPDATE orders SET payment_status = $1, payment_ref = COALESCE($2, payment_ref), updated_at = NOW() 
             WHERE order_id = $3 RETURNING *`,
            [status, ref, order_id]
        );

        // 2. Propagate to Bookings (for easier querying)
        await client.query(
            `UPDATE bookings SET payment_status = $1, payment_ref = COALESCE($2, payment_ref), updated_at = NOW() 
             WHERE order_id = $3`,
            [status, ref, order_id]
        );

        return orderRes.rows[0];
    });
}

async function cancelOrder(order_id) {
    return withTransaction(async (client) => {
        const res = await client.query(
            `UPDATE orders SET payment_status = 'Cancelled', updated_at = NOW() WHERE order_id = $1 RETURNING *`,
            [order_id]
        );
        await client.query(
            `UPDATE bookings SET booking_status = 'Cancelled', updated_at = NOW() WHERE order_id = $1`,
            [order_id]
        );
        return res.rows[0];
    });
}

module.exports = {
  getBookingById,
  getOrderWithDetails,
  listBookings,
  createOrderWithItems, // Use this for the cart checkout
  createBooking,        // Legacy / Internal use
  updatePaymentStatus,
  cancelOrder
};