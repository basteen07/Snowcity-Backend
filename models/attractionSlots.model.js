const { pool, withTransaction } = require('../config/db');

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
    available = true,
  } = payload;

  const { rows } = await pool.query(
    `INSERT INTO attraction_slots
     (attraction_id, start_date, end_date, start_time, end_time, capacity, available)
     VALUES ($1, $2::date, $3::date, $4::time, $5::time, $6, $7)
     RETURNING *`,
    [attraction_id, start_date, end_date, start_time, end_time, capacity, available]
  );
  return rows[0];
}

async function updateSlot(slot_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getSlotById(slot_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    const cast =
      ['start_date', 'end_date'].includes(k) ? '::date' : ['start_time', 'end_time'].includes(k) ? '::time' : '';
    sets.push(`${k} = $${idx + 1}${cast}`);
    params.push(v);
  });
  params.push(slot_id);

  const { rows } = await pool.query(
    `UPDATE attraction_slots SET ${sets.join(', ')}, updated_at = NOW()
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
  const params = [attraction_id, start_time, end_time];
  let sql = `
    SELECT 1
    FROM attraction_slots
    WHERE attraction_id = $1
      AND start_time < $3::time
      AND end_time > $2::time
  `;
  if (exclude_slot_id) {
    sql += ` AND slot_id <> $4`;
    params.push(exclude_slot_id);
  }
  // Date window overlap
  sql += `
    AND NOT ($5::date > end_date OR $6::date < start_date)
  `;
  params.push(start_date, end_date);

  const { rows } = await pool.query(sql, params);
  return !!rows[0];
}

async function getSlotAvailability(slot_id) {
  const { rows } = await pool.query(
    `
    SELECT
      s.slot_id, s.capacity,
      (SELECT COUNT(*) FROM bookings b
       WHERE b.slot_id = s.slot_id AND b.booking_status <> 'Cancelled')::int AS booked
    FROM attraction_slots s
    WHERE s.slot_id = $1
    `,
    [slot_id]
  );
  return rows[0] || null;
}

async function isSlotAvailable(slot_id) {
  const a = await getSlotAvailability(slot_id);
  if (!a) return false;
  return a.booked < a.capacity;
}

// Concurrency-safe check during booking creation
async function assertCapacityAndLock(client, slot_id) {
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
      `SELECT COUNT(*)::int AS c FROM bookings WHERE slot_id = $1 AND booking_status <> 'Cancelled'`,
      [slot_id]
    )
  ).rows[0].c;

  if (booked >= slot.capacity) {
    const err = new Error('Slot capacity full');
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