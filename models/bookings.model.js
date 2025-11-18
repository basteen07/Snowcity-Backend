// models/bookings.model.js
const { pool, withTransaction } = require('../config/db');

// ---------- Row mapper ----------
function mapBooking(row) {
  if (!row) return null;
  return {
    booking_id: row.booking_id,
    booking_ref: row.booking_ref,
    user_id: row.user_id,

    // Product refs
    item_type: row.item_type || null, // 'Attraction' | 'Combo'
    attraction_id: row.attraction_id || null,
    combo_id: row.combo_id || null,
    offer_id: row.offer_id || null,

    // Slot refs
    slot_id: row.slot_id || null,
    combo_slot_id: row.combo_slot_id || null, // may not be used (no table in schema)

    // Counts & timing
    quantity: row.quantity,
    booking_date: row.booking_date,
    booking_time: row.booking_time,

    // Money
    total_amount: row.total_amount,
    discount_amount: row.discount_amount,
    final_amount: row.final_amount,

    // Status
    payment_status: row.payment_status,
    payment_mode: row.payment_mode,
    payment_ref: row.payment_ref,
    booking_status: row.booking_status,

    // Artifacts
    ticket_pdf: row.ticket_pdf,
    whatsapp_sent: row.whatsapp_sent,
    email_sent: row.email_sent,

    // Titles
    attraction_title: row.attraction_title || null,
    combo_title: row.combo_title || row.combo_name || null,
    offer_code: row.offer_code || null,
    offer_title: row.offer_title || null,
    item_title:
      row.item_title ||
      row.attraction_title ||
      row.combo_title ||
      row.combo_name ||
      null,

    // Normalized slot label/times for UI/tickets
    slot_label: row.slot_label || row.attr_slot_label || row.combo_slot_label || null,
    slot_start_time:
      row.slot_start_time || row.attr_slot_start_time || row.combo_slot_start_time || null,
    slot_end_time:
      row.slot_end_time || row.attr_slot_end_time || row.combo_slot_end_time || null,

    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// ---------- Schema capabilities (cached) ----------
let capsCache = null;
async function getCaps() {
  if (capsCache) return capsCache;

  const colQ = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings'
  `;
  const tblQ = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `;
  const [{ rows: colRows }, { rows: tblRows }] = await Promise.all([
    pool.query(colQ),
    pool.query(tblQ)
  ]);
  const cols = new Set(colRows.map(r => r.column_name));
  const tbls = new Set(tblRows.map(r => r.table_name));

  capsCache = {
    hasItemType: cols.has('item_type'),
    hasComboId: cols.has('combo_id'),
    hasComboSlotId: cols.has('combo_slot_id'),
    hasOfferId: cols.has('offer_id'),
    hasComboSlotsTable: tbls.has('combo_slots'),
  };
  return capsCache;
}

function selectPieces(caps) {
  const p = [];
  p.push(`
    b.*,
    a.title AS attraction_title
  `);

  if (caps.hasComboId) {
    const comboTitleExpr = `COALESCE(
      NULLIF(CONCAT_WS(' + ', NULLIF(a1c.title, ''), NULLIF(a2c.title, '')), ''),
      CONCAT('Combo #', c.combo_id::text)
    )`;
    p.push(`
      c.combo_id,
      ${comboTitleExpr} AS combo_title
    `);
    p.comboTitleExpr = comboTitleExpr; // stash for reuse
  }
  if (caps.hasOfferId) {
    p.push(`
      o.title AS offer_title,
      NULL::text AS offer_code
    `);
  } else {
    p.push(`
      NULL::text AS offer_title,
      NULL::text AS offer_code
    `);
  }

  // Attraction slot timing (label column not present in legacy schema)
  p.push(`
    NULL::text AS attr_slot_label,
    s.start_time AS attr_slot_start_time,
    s.end_time AS attr_slot_end_time
  `);

  // If combo_slots table exists and column exists, include its label/times (even if you don’t use it now)
  if (caps.hasComboSlotsTable && caps.hasComboSlotId) {
    p.push(`
      NULL::text AS combo_slot_label,
      cs.start_time AS combo_slot_start_time,
      cs.end_time AS combo_slot_end_time
    `);
  } else {
    p.push(`
      NULL::text AS combo_slot_label,
      NULL::time AS combo_slot_start_time,
      NULL::time AS combo_slot_end_time
    `);
  }

  // Normalized item title
  if (caps.hasItemType && caps.hasComboId) {
    const comboTitle = p.comboTitleExpr || `CONCAT('Combo #', c.combo_id::text)`;
    p.push(`
      CASE WHEN b.item_type = 'Combo'
        THEN ${comboTitle}
        ELSE a.title
      END AS item_title
    `);
  } else if (caps.hasComboId) {
    const comboTitle = p.comboTitleExpr || `CONCAT('Combo #', c.combo_id::text)`;
    p.push(`COALESCE(a.title, ${comboTitle}) AS item_title`);
  } else {
    p.push(`a.title AS item_title`);
  }

  // Normalized slot fields
  if (caps.hasComboSlotsTable && caps.hasComboSlotId) {
    p.push(`
      NULL::text AS slot_label,
      COALESCE(s.start_time, cs.start_time) AS slot_start_time,
      COALESCE(s.end_time, cs.end_time) AS slot_end_time
    `);
  } else {
    p.push(`
      NULL::text AS slot_label,
      s.start_time AS slot_start_time,
      s.end_time AS slot_end_time
    `);
  }

  return p.join(',\n');
}

function joinPieces(caps) {
  const j = [];
  j.push(`LEFT JOIN attractions a       ON a.attraction_id   = b.attraction_id`);
  if (caps.hasComboId) {
    j.push(`LEFT JOIN combos      c       ON c.combo_id        = b.combo_id`);
    j.push(`LEFT JOIN attractions a1c    ON a1c.attraction_id  = c.attraction_1_id`);
    j.push(`LEFT JOIN attractions a2c    ON a2c.attraction_id  = c.attraction_2_id`);
  }
  if (caps.hasOfferId) j.push(`LEFT JOIN offers      o       ON o.offer_id        = b.offer_id`);
  j.push(`LEFT JOIN attraction_slots s  ON s.slot_id         = b.slot_id`);
  if (caps.hasComboSlotsTable && caps.hasComboSlotId) {
    j.push(`LEFT JOIN combo_slots     cs  ON cs.combo_slot_id  = b.combo_slot_id`);
  }
  return j.join('\n');
}

async function baseSelectSql() {
  const caps = await getCaps();
  return `
    SELECT
      ${selectPieces(caps)}
    FROM bookings b
    ${joinPieces(caps)}
  `;
}

// ---------- Queries ----------
async function getBookingById(booking_id) {
  const sql = await baseSelectSql();
  const { rows } = await pool.query(`${sql} WHERE b.booking_id = $1`, [booking_id]);
  return mapBooking(rows[0]);
}

async function listBookings({
  user_id = null,
  attraction_id = null,
  combo_id = null,
  status = null,     // booking_status
  item_type = null,  // 'Attraction' | 'Combo'
  limit = 20,
  offset = 0
} = {}) {
  const caps = await getCaps();
  const where = [];
  const params = [];
  let i = 1;

  if (user_id)       { where.push(`b.user_id = $${i++}`); params.push(user_id); }
  if (attraction_id) { where.push(`b.attraction_id = $${i++}`); params.push(attraction_id); }
  if (combo_id && caps.hasComboId)      { where.push(`b.combo_id = $${i++}`); params.push(combo_id); }
  if (status)        { where.push(`b.booking_status = $${i++}`); params.push(status); }
  if (item_type && caps.hasItemType)    { where.push(`b.item_type = $${i++}::booking_item_type`); params.push(item_type); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = await baseSelectSql();

  const { rows } = await pool.query(
    `
    ${sql}
    ${whereSql}
    ORDER BY b.created_at DESC
    LIMIT $${i} OFFSET $${i + 1}
    `,
    [...params, limit, offset]
  );

  return rows.map(mapBooking);
}

// ---------- Inserts (low-level) ----------
async function createBooking(fields = {}, { client: extClient } = {}) {
  const {
    user_id = null,
    item_type,              // 'Attraction' | 'Combo' (required or inferred)
    attraction_id = null,
    combo_id = null,
    slot_id = null,
    combo_slot_id = null,   // may remain null in your schema
    offer_id = null,

    quantity = 1,
    booking_date = null,

    total_amount,
    discount_amount = 0,
    payment_mode = 'Online'
  } = fields || {};

  const caps = await getCaps();
  const type = item_type || (combo_id ? 'Combo' : 'Attraction');

  const runner = extClient || pool;

  const ins = await runner.query(
    `
    INSERT INTO bookings
      (user_id, item_type, attraction_id, combo_id, slot_id, ${caps.hasComboSlotId ? 'combo_slot_id,' : ''} offer_id,
       quantity, booking_date, total_amount, discount_amount, payment_mode)
    VALUES
      ($1, $2::booking_item_type, $3, $4, $5, ${caps.hasComboSlotId ? '$6,' : ''} ${caps.hasComboSlotId ? '$7' : '$6'},
       $${caps.hasComboSlotId ? 8 : 7}, COALESCE($${caps.hasComboSlotId ? 9 : 8}::date, CURRENT_DATE),
       $${caps.hasComboSlotId ? 10 : 9}, $${caps.hasComboSlotId ? 11 : 10}, $${caps.hasComboSlotId ? 12 : 11}::payment_mode)
    RETURNING *
    `,
    caps.hasComboSlotId
      ? [
          user_id,
          type,
          type === 'Attraction' ? attraction_id : attraction_id, // keep as computed by service
          type === 'Combo' ? combo_id : null,
          type === 'Attraction' ? (slot_id || null) : null,
          type === 'Combo' ? (combo_slot_id || null) : null,
          offer_id || null,
          quantity,
          booking_date || null,
          total_amount,
          discount_amount,
          payment_mode
        ]
      : [
          user_id,
          type,
          attraction_id,
          type === 'Combo' ? combo_id : null,
          type === 'Attraction' ? (slot_id || null) : null,
          offer_id || null,
          quantity,
          booking_date || null,
          total_amount,
          discount_amount,
          payment_mode
        ]
  );

  const created = ins.rows[0];
  const sql = await baseSelectSql();
  const enriched = await runner.query(`${sql} WHERE b.booking_id = $1`, [created.booking_id]);
  return mapBooking(enriched.rows[0] || created);
}

async function createBookings(items = [], { client: extClient } = {}) {
  if (!Array.isArray(items) || !items.length) {
    const err = new Error('items array is required'); err.status = 400; throw err;
  }

  if (extClient) {
    const results = [];
    for (const raw of items) results.push(await createBooking(raw, { client: extClient }));
    return results;
  }

  return withTransaction(async (client) => {
    const results = [];
    for (const raw of items) results.push(await createBooking(raw, { client }));
    return results;
  });
}

// ---------- Mutations ----------
async function updateBooking(booking_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getBookingById(booking_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    const cast =
      k === 'booking_date' ? '::date' :
      k === 'booking_time' ? '::time' :
      k === 'item_type' ? '::booking_item_type' :
      k === 'payment_mode' ? '::payment_mode' :
      '';
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

  const updated = rows[0];
  const sql = await baseSelectSql();
  const enriched = await pool.query(`${sql} WHERE b.booking_id = $1`, [booking_id]);
  return mapBooking(enriched.rows[0] || updated);
}

async function setPayment(booking_id, { payment_status, payment_ref = null }) {
  const { rows } = await pool.query(
    `UPDATE bookings
     SET payment_status = $1, payment_ref = COALESCE($2, payment_ref), updated_at = NOW()
     WHERE booking_id = $3
     RETURNING *`,
    [payment_status, payment_ref, booking_id]
  );
  const updated = rows[0];
  const sql = await baseSelectSql();
  const enriched = await pool.query(`${sql} WHERE b.booking_id = $1`, [booking_id]);
  return mapBooking(enriched.rows[0] || updated);
}

async function setStatus(booking_id, booking_status) {
  const { rows } = await pool.query(
    `UPDATE bookings SET booking_status = $1, updated_at = NOW() WHERE booking_id = $2 RETURNING *`,
    [booking_status, booking_id]
  );
  const updated = rows[0];
  const sql = await baseSelectSql();
  const enriched = await pool.query(`${sql} WHERE b.booking_id = $1`, [booking_id]);
  return mapBooking(enriched.rows[0] || updated);
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
  const updated = rows[0];
  const sql = await baseSelectSql();
  const enriched = await pool.query(`${sql} WHERE b.booking_id = $1`, [booking_id]);
  return mapBooking(enriched.rows[0] || updated);
}

module.exports = {
  getBookingById,
  listBookings,
  createBooking,
  createBookings,
  updateBooking,
  setPayment,
  setStatus,
  cancelBooking
};