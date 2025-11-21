const { pool } = require('../config/db');

function mapOffer(row) {
  if (!row) return null;
  return {
    offer_id: row.offer_id,
    title: row.title,
    description: row.description,
    image_url: row.image_url,
    rule_type: row.rule_type,
    discount_percent: row.discount_percent,
    discount_type: row.discount_type || 'percent',
    discount_value: Number(row.discount_value ?? 0),
    max_discount: row.max_discount != null ? Number(row.max_discount) : null,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    rule_count: row.rule_count != null ? Number(row.rule_count) : undefined,
  };
}

function mapRule(row) {
  if (!row) return null;
  return {
    rule_id: row.rule_id,
    offer_id: row.offer_id,
    target_type: row.target_type,
    target_id: row.target_id,
    applies_to_all: !!row.applies_to_all,
    date_from: row.date_from,
    date_to: row.date_to,
    time_from: row.time_from,
    time_to: row.time_to,
    slot_type: row.slot_type,
    slot_id: row.slot_id,
    rule_discount_type: row.rule_discount_type,
    rule_discount_value: row.rule_discount_value != null ? Number(row.rule_discount_value) : null,
    priority: Number(row.priority ?? 100),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listOfferRules(offer_id) {
  const { rows } = await pool.query(
    `SELECT * FROM offer_rules WHERE offer_id = $1 ORDER BY priority ASC, rule_id ASC`,
    [offer_id]
  );
  return rows.map(mapRule);
}

async function replaceOfferRules(offer_id, rules = []) {
  await pool.query(`DELETE FROM offer_rules WHERE offer_id = $1`, [offer_id]);
  if (!Array.isArray(rules) || !rules.length) return [];

  const cols = [
    'offer_id',
    'target_type',
    'target_id',
    'applies_to_all',
    'date_from',
    'date_to',
    'time_from',
    'time_to',
    'slot_type',
    'slot_id',
    'rule_discount_type',
    'rule_discount_value',
    'priority',
  ];

  const values = [];
  const params = [];
  let idx = 1;
  rules.forEach((rule) => {
    const targetType = rule?.target_type || rule?.targetType || 'attraction';
    const slotType = rule?.slot_type || rule?.slotType || null;
    values.push(`(${cols.map(() => `$${idx++}`).join(', ')})`);
    params.push(
      offer_id,
      targetType,
      rule?.target_id ?? rule?.targetId ?? null,
      !!rule?.applies_to_all,
      rule?.date_from ?? rule?.dateFrom ?? null,
      rule?.date_to ?? rule?.dateTo ?? null,
      rule?.time_from ?? rule?.timeFrom ?? null,
      rule?.time_to ?? rule?.timeTo ?? null,
      slotType,
      rule?.slot_id ?? rule?.slotId ?? null,
      rule?.rule_discount_type ?? rule?.ruleDiscountType ?? null,
      rule?.rule_discount_value ?? rule?.ruleDiscountValue ?? null,
      Number(rule?.priority ?? 100)
    );
  });

  const { rows } = await pool.query(
    `INSERT INTO offer_rules (${cols.join(', ')}) VALUES ${values.join(', ')} RETURNING *`,
    params
  );
  return rows.map(mapRule);
}

async function createOffer(payload = {}) {
  const {
    title,
    description = null,
    image_url = null,
    rule_type = null,
    discount_percent = 0,
    discount_type = 'percent',
    discount_value = 0,
    max_discount = null,
    valid_from = null,
    valid_to = null,
    active = true,
    rules = [],
  } = payload;

  const { rows } = await pool.query(
    `INSERT INTO offers (
        title,
        description,
        image_url,
        rule_type,
        discount_percent,
        discount_type,
        discount_value,
        max_discount,
        valid_from,
        valid_to,
        active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10::date, $11)
      RETURNING *`,
    [
      title,
      description,
      image_url,
      rule_type,
      discount_percent,
      discount_type,
      discount_value,
      max_discount,
      valid_from,
      valid_to,
      active,
    ]
  );

  const offer = mapOffer(rows[0]);
  const storedRules = await replaceOfferRules(offer.offer_id, rules);
  return { ...offer, rules: storedRules };
}

async function getOfferById(offer_id) {
  const { rows } = await pool.query(`SELECT * FROM offers WHERE offer_id = $1`, [offer_id]);
  const offer = mapOffer(rows[0]);
  if (!offer) return null;
  const rules = await listOfferRules(offer.offer_id);
  return { ...offer, rules };
}

async function listOffers({ active = null, rule_type = null, date = null, q = '', limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (active != null) {
    where.push(`active = $${i++}`);
    params.push(Boolean(active));
  }
  if (rule_type) {
    where.push(`rule_type = $${i++}`);
    params.push(rule_type);
  }
  if (date) {
    where.push(`(valid_from IS NULL OR valid_from <= $${i}::date) AND (valid_to IS NULL OR valid_to >= $${i}::date)`);
    params.push(date);
    i += 1;
  }
  if (q) {
    where.push(`(title ILIKE $${i} OR description ILIKE $${i})`);
    params.push(`%${q}%`);
    i += 1;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT o.*, (
        SELECT COUNT(*) FROM offer_rules r WHERE r.offer_id = o.offer_id
      ) AS rule_count
     FROM offers o
     ${whereSql}
     ORDER BY o.created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );
  return rows.map(mapOffer);
}

async function updateOffer(offer_id, payload = {}) {
  const { rules = [], ...fields } = payload || {};
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getOfferById(offer_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    const cast = ['valid_from', 'valid_to'].includes(k) ? '::date' : '';
    sets.push(`${k} = $${idx + 1}${cast}`);
    params.push(v);
  });
  params.push(offer_id);

  const { rows } = await pool.query(
    `UPDATE offers SET ${sets.join(', ')}, updated_at = NOW()
     WHERE offer_id = $${params.length}
     RETURNING *`,
    params
  );
  const offer = mapOffer(rows[0]);
  const storedRules = await replaceOfferRules(offer.offer_id, rules);
  return { ...offer, rules: storedRules };
}

async function deleteOffer(offer_id) {
  const { rowCount } = await pool.query(`DELETE FROM offers WHERE offer_id = $1`, [offer_id]);
  return rowCount > 0;
}

async function findApplicableOfferRule({
  targetType,
  targetId = null,
  slotType = null,
  slotId = null,
  date = null,
  time = null,
}) {
  if (!targetType) return null;
  const matchDate = date || new Date().toISOString().slice(0, 10);
  const matchTime = time || null;

  const params = [
    targetType,
    targetId,
    slotType,
    slotId,
    matchDate,
    matchDate,
    matchTime,
    matchTime,
  ];

  const { rows } = await pool.query(
    `SELECT o.*, r.*
     FROM offers o
     JOIN offer_rules r ON r.offer_id = o.offer_id
     WHERE o.active = true
       AND (o.valid_from IS NULL OR o.valid_from <= $5::date)
       AND (o.valid_to IS NULL OR o.valid_to >= $6::date)
       AND (
            (r.applies_to_all = true AND r.target_type = $1)
         OR (r.target_type = $1 AND r.target_id IS NOT NULL AND $2::int IS NOT NULL AND r.target_id = $2::int)
       )
       AND ($3::text IS NULL OR r.slot_type IS NULL OR r.slot_type = $3::text)
       AND ($4::int IS NULL OR r.slot_id IS NULL OR r.slot_id = $4::int)
       AND (r.date_from IS NULL OR r.date_from <= $5::date)
       AND (r.date_to IS NULL OR r.date_to >= $6::date)
       AND ($7::time IS NULL OR r.time_from IS NULL OR r.time_from <= $7::time)
       AND ($8::time IS NULL OR r.time_to IS NULL OR r.time_to >= $8::time)
     ORDER BY r.priority DESC, r.rule_id DESC
     LIMIT 1`,
    params
  );

  if (!rows.length) return null;
  const offer = mapOffer(rows[0]);
  const rule = mapRule(rows[0]);
  return { offer, rule };
}

module.exports = {
  createOffer,
  getOfferById,
  listOffers,
  listOfferRules,
  replaceOfferRules,
  findApplicableOfferRule,
  updateOffer,
  deleteOffer,
};