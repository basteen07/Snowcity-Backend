#!/usr/bin/env node
require('dotenv').config();
const { pool } = require('../config/db');
const logger = require('../config/logger');
const analyticsModel = require('../models/analytics.model');

function getArg(name, def = null) {
  const idx = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return def;
  const val = process.argv[idx].includes('=')
    ? process.argv[idx].split('=').slice(1).join('=')
    : process.argv[idx + 1];
  return val ?? def;
}

function* daysBetween(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    yield iso;
  }
}

async function processDay(reportDate) {
  // Note: Using booking_date as the reporting dimension (visit date)
  const sql = `
    SELECT
      b.attraction_id,
      COUNT(*)::int AS total_bookings,
      COALESCE(SUM(b.quantity), 0)::int AS total_people,
      COALESCE(SUM(CASE WHEN b.payment_status = 'Completed' THEN b.final_amount ELSE 0 END), 0)::numeric AS total_revenue
    FROM bookings b
    WHERE b.booking_status <> 'Cancelled'
      AND b.booking_date = $1::date
    GROUP BY b.attraction_id
  `;

  const { rows } = await pool.query(sql, [reportDate]);
  if (!rows.length) {
    logger.info(`No bookings found for ${reportDate}`);
    return 0;
  }

  let upserts = 0;
  for (const r of rows) {
    await analyticsModel.upsertDaily({
      attraction_id: r.attraction_id,
      report_date: reportDate,
      bookingsInc: Number(r.total_bookings || 0),
      peopleInc: Number(r.total_people || 0),
      revenueInc: Number(r.total_revenue || 0),
    });
    upserts += 1;
  }
  logger.info(`Analytics upserted for ${reportDate}: ${upserts} attraction(s)`);
  return upserts;
}

async function main() {
  try {
    const dateArg = getArg('date', null);
    const fromArg = getArg('from', null);
    const toArg = getArg('to', null);

    let total = 0;

    if (dateArg) {
      const reportDate =
        dateArg.toLowerCase() === 'yesterday'
          ? new Date(Date.now() - 86400000).toISOString().slice(0, 10)
          : dateArg;
      total += await processDay(reportDate);
    } else if (fromArg && toArg) {
      for (const d of daysBetween(fromArg, toArg)) {
        total += await processDay(d);
      }
    } else {
      // default: yesterday
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      total += await processDay(y);
    }

    logger.info(`syncAnalytics done. Total upserts: ${total}`);
  } catch (err) {
    logger.error('syncAnalytics failed', { err: err.message, stack: err.stack });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}