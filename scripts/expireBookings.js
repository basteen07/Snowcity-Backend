#!/usr/bin/env node
require('dotenv').config();
const { pool } = require('../config/db');
const logger = require('../config/logger');

function getArg(name, def = null) {
  const idx = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return def;
  const val = process.argv[idx].includes('=')
    ? process.argv[idx].split('=').slice(1).join('=')
    : process.argv[idx + 1];
  return val ?? def;
}

// Expire bookings whose slot end time has passed (with optional grace minutes)
async function expireOldBookings(graceMins = 0) {
  // Only slot-based bookings are considered here
  const sql = `
    WITH due AS (
      SELECT b.booking_id
      FROM bookings b
      JOIN attraction_slots s ON s.slot_id = b.slot_id
      WHERE b.booking_status = 'Booked'
        AND b.slot_id IS NOT NULL
        AND (b.booking_date + s.end_time) < NOW() - make_interval(mins => $1::int)
    )
    UPDATE bookings AS ub
      SET booking_status = 'Expired',
          updated_at = NOW()
    FROM due
    WHERE ub.booking_id = due.booking_id
    RETURNING ub.booking_id
  `;
  const { rows } = await pool.query(sql, [graceMins]);
  return rows.length;
}

async function main() {
  try {
    const grace = parseInt(getArg('grace', '0'), 10); // minutes
    const count = await expireOldBookings(Number.isFinite(grace) ? grace : 0);
    logger.info(`expireBookings: ${count} booking(s) marked as Expired (grace=${grace}m).`);
  } catch (err) {
    logger.error('expireBookings failed', { err: err.message, stack: err.stack });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}