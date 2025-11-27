const { pool, withTransaction } = require('../config/db');

const MONTH_LETTERS = ['j', 'f', 'm', 'a', 'm', 'j', 'j', 'a', 's', 'o', 'n', 'd'];

function normalizeDayTokens(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return { monthLetter: 'x', dayToken: '00' };
  }
  const monthLetter = MONTH_LETTERS[date.getUTCMonth()] || 'x';
  const dayToken = String(date.getUTCDate()).padStart(2, '0');
  return { monthLetter, dayToken };
}

async function computeAttractionSlotCode({ attraction_id, start_date, start_time, capacity }) {
  if (!attraction_id || !start_date || !start_time) return null;
  const { rows: attractionRows } = await pool.query(`SELECT title FROM attractions WHERE attraction_id = $1`, [attraction_id]);
  const title = attractionRows[0]?.title || '';
  const nameLetter = title.trim().charAt(0).toLowerCase() || 'x';
  const { monthLetter, dayToken } = normalizeDayTokens(start_date);

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM attraction_slots
     WHERE attraction_id = $1
       AND start_date = $2::date
       AND start_time < $3::time`,
    [attraction_id, start_date, start_time]
  );
  const slotIndex = (countRows[0]?.count || 0) + 1;
  const slotToken = String(Math.min(slotIndex, 99)).padStart(2, '0');
  const capToken = String(Math.min(Number(capacity) || 0, 999)).padStart(3, '0');
  return `${nameLetter}${monthLetter}${dayToken}${slotToken}${capToken}`;
}

async function getSlotById(slot_id) {
  const { rows } = await pool.query(`SELECT * FROM attraction_slots WHERE slot_id = $1`, [slot_id]);
  return rows[0] || null;
}

async function listSlots({ attraction_id = null, date = null, start_date = null, end_date = null } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (attraction_id) {
    where.push(`aslt.attraction_id = $${i++}`);
    params.push(Number(attraction_id));
  }
  if (date) {
    where.push(`$${i}::date BETWEEN aslt.start_date AND aslt.end_date`);
    params.push(date);
    i += 1;
  } else {
    if (start_date) {
      where.push(`aslt.end_date >= $${i++}::date`);
      params.push(start_date);
    }
    if (end_date) {
      where.push(`aslt.start_date <= $${i++}::date`);
      params.push(end_date);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT aslt.*, a.title AS attraction_title
     FROM attraction_slots aslt
     JOIN attractions a ON a.attraction_id = aslt.attraction_id
     ${whereSql}
     ORDER BY aslt.start_date ASC, aslt.start_time ASC`,
    params
  );
  return rows;
}

async function createSlot(payload) {
  const {
    attraction_id,
    start_date,
    end_date,
    start_time,
    end_time,
    capacity,
    price: rawPrice = null,
    available: rawAvailable = true,
  } = payload;

  // sanitize inputs
  const aid = Number(attraction_id);
  const cap = Number(capacity);
  let price = rawPrice;
  if (price === '' || price === undefined || price === null) price = null;
  else {
    const n = Number(price);
    price = Number.isNaN(n) ? null : n;
  }
  const available = rawAvailable === 'false' ? false : Boolean(rawAvailable);
  const slotCode = await computeAttractionSlotCode({ attraction_id: aid, start_date, start_time, capacity: cap });

  try {
    const { rows } = await pool.query(
      `INSERT INTO attraction_slots
       (attraction_id, start_date, end_date, start_time, end_time, capacity, price, available, slot_code)
       VALUES ($1, $2::date, $3::date, $4::time, $5::time, $6, $7, $8, $9)
       RETURNING *`,
      [aid, start_date, end_date, start_time, end_time, cap, price, available, slotCode]
    );
    return rows[0];
  } catch (err) {
    // Fallback if 'price' column does not exist in the current schema
    if (err && (err.code === '42703' || /column\s+"?price"?\s+does not exist/i.test(String(err.message)))) {
      const { rows } = await pool.query(
        `INSERT INTO attraction_slots
         (attraction_id, start_date, end_date, start_time, end_time, capacity, available, slot_code)
         VALUES ($1, $2::date, $3::date, $4::time, $5::time, $6, $7, $8)
         RETURNING *`,
        [aid, start_date, end_date, start_time, end_time, cap, available, slotCode]
      );
      return rows[0];
    }
    throw err;
  }
}

async function updateSlot(slot_id, fields = {}) {
  const current = await getSlotById(slot_id);
  if (!current) return null;

  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getSlotById(slot_id);

  const sets = [];
  const params = [];
  const nextState = { ...current };
  entries.forEach(([k, v]) => {
    let val = v;
    if (k === 'price') {
      if (val === '' || val === null || val === undefined) val = null;
      else {
        const n = Number(val);
        val = Number.isNaN(n) ? null : n;
      }
    } else if (k === 'capacity' || k === 'attraction_id') {
      val = Number(v);
      nextState[k] = val;
    } else if (k === 'available') {
      val = v === 'false' ? false : Boolean(v);
      nextState[k] = val;
    }
    const cast =
      ['start_date', 'end_date'].includes(k) ? '::date' : ['start_time', 'end_time'].includes(k) ? '::time' : '';
    nextState[k] = val;
    sets.push({ key: k, cast, value: val });
  });

  const needsRecode = ['attraction_id', 'start_date', 'start_time', 'capacity'].some((key) => fields[key] !== undefined);
  if (needsRecode) {
    const slotCode = await computeAttractionSlotCode({
      attraction_id: nextState.attraction_id,
      start_date: nextState.start_date,
      start_time: nextState.start_time,
      capacity: nextState.capacity,
    });
    sets.push({ key: 'slot_code', cast: '', value: slotCode });
  }

  const sqlFragments = sets.map((entry, idx) => {
    params.push(entry.value);
    return `${entry.key} = $${idx + 1}${entry.cast}`;
  });
  params.push(slot_id);

  const { rows } = await pool.query(
    `UPDATE attraction_slots SET ${sqlFragments.join(', ')}, updated_at = NOW()
     WHERE slot_id = $${params.length}
     RETURNING *`,
    params
  );
  return rows[0] || null;
}

async function deleteSlot(slot_id) {
  const { rowCount } = await pool.query(`DELETE FROM attraction_slots WHERE slot_id = $1`, [slot_id]);
  return rowCount > 0;
}

async function slotOverlapExists({ attraction_id, start_date, end_date, start_time, end_time, exclude_slot_id = null }) {
  const params = [];
  let i = 1;
  let sql = `SELECT 1 FROM attraction_slots WHERE attraction_id = $${i++}`;
  params.push(Number(attraction_id));
  sql += ` AND start_time < $${i++}::time`;
  params.push(end_time);
  sql += ` AND end_time > $${i++}::time`;
  params.push(start_time);
  if (exclude_slot_id) {
    sql += ` AND slot_id <> $${i++}`;
    params.push(Number(exclude_slot_id));
  }
  sql += ` AND NOT ($${i}::date > end_date OR $${i + 1}::date < start_date)`;
  params.push(start_date, end_date);

  const { rows } = await pool.query(sql, params);
  return !!rows[0];
}

async function getSlotAvailability(slot_id) {
  const { rows } = await pool.query(
    `
    SELECT
      s.slot_id, s.capacity,
      (SELECT COALESCE(SUM(b.quantity), 0) FROM bookings b
       WHERE b.slot_id = s.slot_id AND b.booking_status <> 'Cancelled')::int AS booked
    FROM attraction_slots s
    WHERE s.slot_id = $1
    `,
    [slot_id]
  );
  return rows[0] || null;
}

async function isSlotAvailable(slot_id, qty = 1) {
  const a = await getSlotAvailability(slot_id);
  if (!a) return false;
  return a.booked + Math.max(1, Number(qty || 1)) <= a.capacity;
}

// Concurrency-safe check during booking creation
async function assertCapacityAndLock(client, slot_id, qty = 1) {
  // lock slot row to serialize concurrent bookings on the same slot
  const slot = (
    await client.query(`SELECT * FROM attraction_slots WHERE slot_id = $1 FOR UPDATE`, [slot_id])
  ).rows[0];
  if (!slot || slot.available === false) {
    const err = new Error('Slot not available');
    err.status = 409;
    throw err;
  }
  const booked = (
    await client.query(
      `SELECT COALESCE(SUM(quantity), 0)::int AS c FROM bookings WHERE slot_id = $1 AND booking_status <> 'Cancelled'`,
      [slot_id]
    )
  ).rows[0].c;

  const requestQty = Math.max(1, Number(qty || 1));
  if (booked + requestQty > slot.capacity) {
    const err = new Error('Slot capacity insufficient');
    err.status = 409;
    throw err;
  }
  return { slot, booked };
}

module.exports = {
  getSlotById,
  listSlots,
  createSlot,
  updateSlot,
  deleteSlot,
  slotOverlapExists,
  getSlotAvailability,
  isSlotAvailable,
  assertCapacityAndLock,
};