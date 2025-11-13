const { pool } = require('../config/db');

function mapComboSlot(row) {
  if (!row) return null;
  return {
    combo_slot_id: row.combo_slot_id,
    combo_id: row.combo_id,
    start_date: row.start_date,
    end_date: row.end_date,
    start_time: row.start_time,
    end_time: row.end_time,
    capacity: row.capacity,
    price: row.price != null ? Number(row.price) : null,
    available: row.available,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getSlotById(combo_slot_id) {
  const { rows } = await pool.query(`SELECT * FROM combo_slots WHERE combo_slot_id = $1`, [combo_slot_id]);
  return mapComboSlot(rows[0]);
}

async function listSlots({ combo_id = null, date = null, start_date = null, end_date = null } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (combo_id) {
    where.push(`cs.combo_id = $${i++}`);
    params.push(Number(combo_id));
  }
  if (date) {
    where.push(`$${i}::date BETWEEN cs.start_date AND cs.end_date`);
    params.push(date);
    i += 1;
  } else {
    if (start_date) {
      where.push(`cs.end_date >= $${i++}::date`);
      params.push(start_date);
    }
    if (end_date) {
      where.push(`cs.start_date <= $${i++}::date`);
      params.push(end_date);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT cs.*
     FROM combo_slots cs
     ${whereSql}
     ORDER BY cs.start_date ASC, cs.start_time ASC`,
    params
  );
  return rows.map(mapComboSlot);
}

async function listSlotsByCombo(combo_id) {
  return listSlots({ combo_id });
}

async function createSlot(payload) {
  const {
    combo_id,
    start_date,
    end_date,
    start_time,
    end_time,
    capacity,
    price = null,
    available = true,
  } = payload;

  const { rows } = await pool.query(
    `INSERT INTO combo_slots
       (combo_id, start_date, end_date, start_time, end_time, capacity, price, available)
     VALUES ($1, $2::date, $3::date, $4::time, $5::time, $6, $7, $8)
     RETURNING *`,
    [Number(combo_id), start_date, end_date, start_time, end_time, Number(capacity), price, available]
  );
  return mapComboSlot(rows[0]);
}

async function updateSlot(combo_slot_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getSlotById(combo_slot_id);

  const sets = [];
  const params = [];
  entries.forEach(([key, value], idx) => {
    let val = value;
    if (key === 'capacity' || key === 'combo_id') {
      val = Number(val);
    } else if (key === 'price') {
      if (val === '' || val === null || val === undefined) val = null;
      else {
        const num = Number(val);
        val = Number.isNaN(num) ? null : num;
      }
    } else if (key === 'available') {
      val = val === 'false' ? false : Boolean(val);
    }
    const cast = ['start_date', 'end_date'].includes(key)
      ? '::date'
      : ['start_time', 'end_time'].includes(key)
      ? '::time'
      : '';
    sets.push(`${key} = $${idx + 1}${cast}`);
    params.push(val);
  });
  params.push(combo_slot_id);

  const { rows } = await pool.query(
    `UPDATE combo_slots SET ${sets.join(', ')}, updated_at = NOW()
     WHERE combo_slot_id = $${params.length}
     RETURNING *`,
    params
  );
  return mapComboSlot(rows[0]);
}

async function deleteSlot(combo_slot_id) {
  const { rowCount } = await pool.query(`DELETE FROM combo_slots WHERE combo_slot_id = $1`, [combo_slot_id]);
  return rowCount > 0;
}

async function slotOverlapExists({ combo_id, start_date, end_date, start_time, end_time, exclude_slot_id = null }) {
  const params = [];
  let i = 1;
  let sql = `SELECT 1 FROM combo_slots WHERE combo_id = $${i++}`;
  params.push(Number(combo_id));
  sql += ` AND start_time < $${i++}::time`;
  params.push(end_time);
  sql += ` AND end_time > $${i++}::time`;
  params.push(start_time);
  if (exclude_slot_id) {
    sql += ` AND combo_slot_id <> $${i++}`;
    params.push(Number(exclude_slot_id));
  }
  sql += ` AND NOT ($${i}::date > end_date OR $${i + 1}::date < start_date)`;
  params.push(start_date, end_date);

  const { rows } = await pool.query(sql, params);
  return !!rows[0];
}

async function getSlotAvailability(combo_slot_id) {
  const { rows } = await pool.query(
    `SELECT cs.combo_slot_id, cs.capacity,
            (SELECT COALESCE(SUM(quantity), 0)::int FROM bookings b
             WHERE b.combo_slot_id = cs.combo_slot_id AND b.booking_status <> 'Cancelled') AS booked
     FROM combo_slots cs
     WHERE cs.combo_slot_id = $1`,
    [combo_slot_id]
  );
  return rows[0] || null;
}

async function assertCapacityAndLock(client, combo_slot_id, qty = 1) {
  const slot = (
    await client.query(`SELECT * FROM combo_slots WHERE combo_slot_id = $1 FOR UPDATE`, [combo_slot_id])
  ).rows[0];
  if (!slot || slot.available === false) {
    const err = new Error('Combo slot not available');
    err.status = 409;
    throw err;
  }

  const booked = (
    await client.query(
      `SELECT COALESCE(SUM(quantity), 0)::int AS count
       FROM bookings
       WHERE combo_slot_id = $1 AND booking_status <> 'Cancelled'`,
      [combo_slot_id]
    )
  ).rows[0].count;

  const requestQty = Math.max(1, Number(qty || 1));
  if (booked + requestQty > slot.capacity) {
    const err = new Error('Combo slot capacity insufficient');
    err.status = 409;
    throw err;
  }
  return { slot, booked };
}

module.exports = {
  mapComboSlot,
  getSlotById,
  listSlots,
  listSlotsByCombo,
  createSlot,
  updateSlot,
  deleteSlot,
  slotOverlapExists,
  getSlotAvailability,
  assertCapacityAndLock,
};
