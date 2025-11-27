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
  
  console.log('=== OFFER VALIDATION DEBUG ===');
  console.log('Inputs:', { targetType, targetId, slotType, slotId, matchDate, matchTime });
  
  // Create current datetime for validation
  const now = new Date();
  
  // Create booking datetime if date and time are provided
  let bookingDateTime = null;
  if (date && time) {
    // Convert time format (handle both 12-hour with AM/PM and 24-hour formats)
    let normalizedTime = time;
    if (time.includes('.') && (time.includes('am') || time.includes('pm'))) {
      // Handle format like "10.00am" or "01.00pm"
      const timeMatch = time.match(/(\d{1,2})\.(\d{2})(am|pm)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const period = timeMatch[3].toLowerCase();
        
        if (period === 'pm' && hours !== 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        
        normalizedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }
    
    bookingDateTime = new Date(`${date}T${normalizedTime}`);
    console.log('Normalized time:', normalizedTime);
    console.log('Booking datetime:', bookingDateTime);
  }

  const params = [
    targetType,
    targetId,
    slotType,
    slotId,
    matchDate,
  ];
  
  console.log('SQL Parameters:', params);

  const { rows } = await pool.query(
    `SELECT o.*, r.*
     FROM offers o
     JOIN offer_rules r ON r.offer_id = o.offer_id
     WHERE o.active = true
       AND (
           -- Offer is valid if no dates are set OR current date is within the offer period
           (o.valid_from IS NULL AND o.valid_to IS NULL) OR
           (o.valid_from IS NULL AND o.valid_to >= CURRENT_DATE) OR
           (o.valid_to IS NULL AND o.valid_from <= CURRENT_DATE) OR
           (o.valid_from <= CURRENT_DATE AND o.valid_to >= CURRENT_DATE)
         )
       AND (
            (r.applies_to_all = true AND r.target_type = $1)
         OR (r.target_type = $1 AND r.target_id IS NOT NULL AND $2::int IS NOT NULL AND r.target_id = $2::int)
       )
       AND ($3::text IS NULL OR r.slot_type IS NULL OR r.slot_type = $3::text)
       AND ($4::int IS NULL OR r.slot_id IS NULL OR r.slot_id = $4::int)
       -- Rule date validation
       AND (r.date_from IS NULL OR r.date_from <= $5::date)
       AND (r.date_to IS NULL OR r.date_to >= $5::date)
     ORDER BY r.priority DESC, r.rule_id DESC
     LIMIT 1`,
    params
  );

  console.log('SQL rows found:', rows.length);
  if (!rows.length) return null;
  
  const offer = mapOffer(rows[0]);
  const rule = mapRule(rows[0]);
  
  console.log('Found offer:', { 
    offer_id: offer.offer_id, 
    title: offer.title, 
    valid_from: offer.valid_from, 
    valid_to: offer.valid_to 
  });
  console.log('Found rule:', { 
    rule_id: rule.rule_id, 
    target_type: rule.target_type, 
    target_id: rule.target_id,
    date_from: rule.date_from,
    date_to: rule.date_to,
    time_from: rule.time_from,
    time_to: rule.time_to
  });
  
  // Additional validation: check if offer has actually expired
  if (offer.valid_to) {
    const validToDateTime = new Date(offer.valid_to);
    // If offer valid_to is a date only, set time to end of day
    if (offer.valid_to.length === 10) {
      validToDateTime.setHours(23, 59, 59, 999);
    }
    
    console.log('Offer valid_to datetime:', validToDateTime);
    console.log('Current datetime:', now);
    
    // If current datetime is past offer valid_to, don't apply
    if (now > validToDateTime) {
      console.log('OFFER EXPIRED - current time is past valid_to');
      return null;
    }
  }
  
  // Rule time validation - only apply if both rule time and booking time are provided
  if (rule.time_from && rule.time_to && matchTime) {
    console.log('Checking time validation...');
    
    // Convert rule times to minutes since midnight for comparison
    const ruleTimeFromMinutes = timeToMinutes(rule.time_from);
    const ruleTimeToMinutes = timeToMinutes(rule.time_to);
    
    // Convert booking time to minutes since midnight
    const bookingTimeMinutes = timeToMinutes(matchTime);
    
    console.log('Time comparison:', {
      ruleTimeFrom: rule.time_from,
      ruleTimeFromMinutes,
      ruleTimeTo: rule.time_to,
      ruleTimeToMinutes,
      bookingTime: matchTime,
      bookingTimeMinutes
    });
    
    // Check if booking time falls within rule time range
    if (bookingTimeMinutes < ruleTimeFromMinutes || bookingTimeMinutes > ruleTimeToMinutes) {
      console.log('TIME VALIDATION FAILED - booking time outside rule time range');
      return null;
    }
    
    console.log('TIME VALIDATION PASSED');
  } else if (rule.time_from && !matchTime) {
    // If rule has time constraint but no booking time provided, don't apply
    console.log('TIME VALIDATION FAILED - rule has time constraint but no booking time provided');
    return null;
  }
  
  console.log('OFFER VALIDATION PASSED - applying offer');
  console.log('=== END OFFER VALIDATION DEBUG ===');
  
  return { offer, rule };
}

// Helper function to convert time string to minutes since midnight
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  
  // Handle various time formats
  let normalizedTime = timeStr;
  
  // Handle format like "10.00am" or "01.00pm"
  if (timeStr.includes('.') && (timeStr.includes('am') || timeStr.includes('pm'))) {
    const timeMatch = timeStr.match(/(\d{1,2})\.(\d{2})(am|pm)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const period = timeMatch[3].toLowerCase();
      
      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      
      return hours * 60 + minutes;
    }
  }
  
  // Handle standard HH:MM format
  const timeMatch = normalizedTime.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    return hours * 60 + minutes;
  }
  
  return 0;
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