const { pool } = require('../config/db');

function mapCoupon(row) {
  if (!row) return null;
  return {
    coupon_id: row.coupon_id,
    code: row.code,
    type: row.type,
    value: row.value,
    description: row.description,
    attraction_id: row.attraction_id,
    min_amount: row.min_amount,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createCoupon({
  code,
  description = null,
  type,
  value,
  attraction_id = null,
  min_amount = 0,
  valid_from,
  valid_to,
  active = true,
}) {
  const { rows } = await pool.query(
    `INSERT INTO coupons (code, description, "type", value, attraction_id, min_amount, valid_from, valid_to, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9)
     RETURNING *`,
    [code, description, type, value, attraction_id, min_amount, valid_from, valid_to, active]
  );
  return mapCoupon(rows[0]);
}

async function getCouponById(coupon_id) {
  const { rows } = await pool.query(`SELECT * FROM coupons WHERE coupon_id = $1`, [coupon_id]);
  return mapCoupon(rows[0]);
}

async function getCouponByCode(code, { activeOnly = true, onDate = null, attraction_id = null } = {}) {
  const where = [`LOWER(code) = LOWER($1)`];
  const params = [code];
  let i = 2;

  if (activeOnly) {
    where.push(`active = TRUE`);
  }
  if (onDate) {
    where.push(`valid_from <= $${i}::date AND valid_to >= $${i}::date`);
    params.push(onDate);
    i += 1;
  }
  if (attraction_id) {
    // coupon either global (NULL) or matches attraction
    where.push(`(attraction_id IS NULL OR attraction_id = $${i})`);
    params.push(Number(attraction_id));
    i += 1;
  }

  const { rows } = await pool.query(`SELECT * FROM coupons WHERE ${where.join(' AND ')} LIMIT 1`, params);
  return mapCoupon(rows[0]);
}

async function listCoupons({ active = null, attraction_id = null, date = null, q = '', limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (active != null) {
    where.push(`active = $${i++}`);
    params.push(Boolean(active));
  }
  if (attraction_id) {
    where.push(`(attraction_id IS NULL OR attraction_id = $${i++})`);
    params.push(Number(attraction_id));
  }
  if (date) {
    where.push(`valid_from <= $${i}::date AND valid_to >= $${i}::date`);
    params.push(date);
    i += 1;
  }
  if (q) {
    where.push(`(code ILIKE $${i} OR description ILIKE $${i})`);
    params.push(`%${q}%`);
    i += 1;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM coupons
     ${whereSql}
     ORDER BY valid_from DESC, code ASC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );
  return rows.map(mapCoupon);
}

async function updateCoupon(coupon_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getCouponById(coupon_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    const cast = ['valid_from', 'valid_to'].includes(k) ? '::date' : '';
    const col = k === 'type' ? '"type"' : k;
    sets.push(`${col} = $${idx + 1}${cast}`);
    params.push(v);
  });
  params.push(coupon_id);

  const { rows } = await pool.query(
    `UPDATE coupons SET ${sets.join(', ')}, updated_at = NOW()
     WHERE coupon_id = $${params.length}
     RETURNING *`,
    params
  );
  return mapCoupon(rows[0]);
}

async function deleteCoupon(coupon_id) {
  const { rowCount } = await pool.query(`DELETE FROM coupons WHERE coupon_id = $1`, [coupon_id]);
  return rowCount > 0;
}

async function computeDiscount(coupon, total_amount) {
  if (!coupon) return { discount: 0, reason: 'coupon_not_found' };

  if (total_amount < Number(coupon.min_amount || 0)) {
    return { discount: 0, reason: 'min_amount_not_met' };
  }

  switch (String(coupon.type).toLowerCase()) {
    case 'flat':
      return { discount: Math.min(Number(coupon.value), Number(total_amount)), reason: 'ok' };
    case 'percent':
      return { discount: Math.max(0, (Number(total_amount) * Number(coupon.value)) / 100), reason: 'ok' };
    default:
      // bogo/specific need cart context; handled in higher layer
      return { discount: 0, reason: 'unsupported_coupon_type' };
  }
}

module.exports = {
  createCoupon,
  getCouponById,
  getCouponByCode,
  listCoupons,
  updateCoupon,
  deleteCoupon,
  computeDiscount,
};