#!/usr/bin/env node
require('dotenv').config();

const path = require('path');
const { pool } = require('../config/db');
const slotScheduler = require('../services/slotScheduler');

async function fetchActiveIds(table, idColumn) {
  const { rows } = await pool.query(`SELECT ${idColumn} FROM ${table} WHERE active = TRUE`);
  return rows.map((row) => Number(row[idColumn])).filter(Boolean);
}

async function extendAttractions(daysAhead = 1) {
  const attractionIds = await fetchActiveIds('attractions', 'attraction_id');
  for (const attractionId of attractionIds) {
    try {
      await slotScheduler.extendAttractionSchedule({ attractionId, daysAhead });
    } catch (err) {
      console.error(`Failed to extend slots for attraction ${attractionId}`, err);
    }
  }
}

async function extendCombos(daysAhead = 1) {
  const comboIds = await fetchActiveIds('combos', 'combo_id');
  for (const comboId of comboIds) {
    try {
      await slotScheduler.extendComboSchedule({ comboId, daysAhead });
    } catch (err) {
      console.error(`Failed to extend slots for combo ${comboId}`, err);
    }
  }
}

async function main() {
  const daysAhead = Number(process.env.SLOT_EXTEND_DAYS || 1);
  await extendAttractions(daysAhead);
  await extendCombos(daysAhead);
  await pool.end();
  console.log('Slot schedules extended successfully');
}

main().catch((err) => {
  console.error('Slot extension job failed', err);
  pool.end().finally(() => process.exit(1));
});
