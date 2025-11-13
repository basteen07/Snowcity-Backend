const { pool, withTransaction } = require('../config/db');
const { assertCapacityAndLock } = require('./attractionSlots.model');

function mapBooking(row) {
  if (!row) return null;
  return {
    booking_id: row.booking_id,
    booking_ref: row.booking_ref,
    user_id: row.user_id,
    attraction_id: row.attraction_id,
    combo_id: row.combo_id,
    combo_slot_id: row.combo_slot_id,
    slot_id: row.slot_id,
    quantity: row.quantity,
    booking_date: row.booking_date,
    booking_time: row.booking_time,
    total_amount: row.total_amount,
    discount_amount: row.discount_amount,
    final_amount: row.final_amount,
    payment_status: row.payment_status,
    payment_mode: row.payment_mode,
    payment_ref: row.payment_ref,
    booking_status: row.booking_status,
    ticket_pdf: row.ticket_pdf,
    attraction_title: row.attraction_title,
    // Optional nested slot info when joined
    slot: (row.slot_start_time || row.slot_end_time)
      ? {
          start_time: row.slot_start_time || null,
          end_time: row.slot_end_time || null,
          label:
            row.slot_start_time && row.slot_end_time
              ? `${row.slot_start_time} - ${row.slot_end_time}`
              : null,
        }
      : undefined,
    whatsapp_sent: row.whatsapp_sent,
    email_sent: row.email_sent,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getBookingById(booking_id) {
  const { rows } = await pool.query(`SELECT * FROM bookings WHERE booking_id = $1`, [booking_id]);
  return mapBooking(rows[0]);
}

async function listBookings({ user_id = null, attraction_id = null, status = null, limit = 20, offset = 0 } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (user_id) {
    where.push(`b.user_id = $${i++}`);
    params.push(user_id);
  }
  if (attraction_id) {
    where.push(`b.attraction_id = $${i++}`);
    params.push(attraction_id);
  }
  if (status) {
    where.push(`b.booking_status = $${i++}`);
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `
    SELECT b.*,
           a.title AS attraction_title,
           s.start_time AS slot_start_time,
           s.end_time   AS slot_end_time
    FROM bookings b
    LEFT JOIN attractions a ON a.attraction_id = b.attraction_id
    LEFT JOIN attraction_slots s ON s.slot_id = b.slot_id
    ${whereSql}
    ORDER BY b.created_at DESC
    LIMIT $${i} OFFSET $${i + 1}
    `,
    [...params, limit, offset]
  );

  return rows.map(mapBooking);
}

async function createBooking({
  user_id = null,
  attraction_id = null,
  combo_id = null,
  slot_id = null,
  quantity = 1,
  booking_date = null,
  booking_time = null,
  total_amount,
  discount_amount = 0,
  payment_mode = 'Online',
}) {
  return withTransaction(async (client) => {
    // capacity check if slot booking
    if (slot_id) {
      await assertCapacityAndLock(client, slot_id);
    }

    const { rows } = await client.query(
      `INSERT INTO bookings
       (user_id, attraction_id, combo_id, slot_id, quantity, booking_date, booking_time, total_amount, discount_amount, payment_mode)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7::time, $8, $9, $10)
       RETURNING *`,
      [
        user_id,
        attraction_id,
        combo_id,
        slot_id,
        quantity,
        booking_date,
        booking_time,
        total_amount,
        discount_amount,
        payment_mode,
      ]
    );

    return mapBooking(rows[0]);
  });
}

async function updateBooking(booking_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getBookingById(booking_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    const cast = ['booking_date'].includes(k)
      ? '::date'
      : ['booking_time'].includes(k)
      ? '::time'
      : '';
    sets.push(`${k} = $${idx + 1}${cast}`);
    params.push(v);
  });
  params.push(booking_id);

  const { rows } = await pool.query(
    `UPDATE bookings SET ${sets.join(', ')}, updated_at = NOW()
     WHERE booking_id = $${params.length}
     RETURNING *`,
    params
  );
  return mapBooking(rows[0]);
}

async function setPayment(booking_id, { payment_status, payment_ref = null }) {
  const { rows } = await pool.query(
    `UPDATE bookings
     SET payment_status = $1, payment_ref = COALESCE($2, payment_ref), updated_at = NOW()
     WHERE booking_id = $3
     RETURNING *`,
    [payment_status, payment_ref, booking_id]
  );
  return mapBooking(rows[0]);
}

async function setStatus(booking_id, booking_status) {
  const { rows } = await pool.query(
    `UPDATE bookings SET booking_status = $1, updated_at = NOW() WHERE booking_id = $2 RETURNING *`,
    [booking_status, booking_id]
  );
  return mapBooking(rows[0]);
}

async function cancelBooking(booking_id) {
  const { rows } = await pool.query(
    `UPDATE bookings
     SET booking_status = 'Cancelled',
         payment_status = CASE WHEN payment_status = 'Pending' THEN 'Cancelled' ELSE payment_status END,
         updated_at = NOW()
     WHERE booking_id = $1
     RETURNING *`,
    [booking_id]
  );
  return mapBooking(rows[0]);
}

module.exports = {
  getBookingById,
  listBookings,
  createBooking,
  updateBooking,
  setPayment,
  setStatus,
  cancelBooking,
};