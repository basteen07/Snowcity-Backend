const { pool } = require('../config/db');

async function listByBooking(booking_id) {
  const { rows } = await pool.query(
    `SELECT ba.*, ad.title AS addon_title
     FROM booking_addons ba
     JOIN addons ad ON ad.addon_id = ba.addon_id
     WHERE ba.booking_id = $1
     ORDER BY ad.title ASC`,
    [booking_id]
  );
  return rows;
}

async function upsertBookingAddon({ booking_id, addon_id, quantity = 1, price }) {
  const { rows } = await pool.query(
    `INSERT INTO booking_addons (booking_id, addon_id, quantity, price)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (booking_id, addon_id)
     DO UPDATE SET quantity = EXCLUDED.quantity, price = EXCLUDED.price, updated_at = NOW()
     RETURNING *`,
    [booking_id, addon_id, quantity, price]
  );
  return rows[0];
}

async function removeBookingAddon(booking_id, addon_id) {
  const { rowCount } = await pool.query(
    `DELETE FROM booking_addons WHERE booking_id = $1 AND addon_id = $2`,
    [booking_id, addon_id]
  );
  return rowCount > 0;
}

async function clearBookingAddons(booking_id) {
  const { rowCount } = await pool.query(`DELETE FROM booking_addons WHERE booking_id = $1`, [booking_id]);
  return rowCount;
}

module.exports = {
  listByBooking,
  upsertBookingAddon,
  removeBookingAddon,
  clearBookingAddons,
};