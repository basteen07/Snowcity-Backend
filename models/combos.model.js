const { pool } = require('../config/db');

async function createCombo({ attraction_1_id, attraction_2_id, combo_price, discount_percent = 0, active = true }) {
  const { rows } = await pool.query(
    `INSERT INTO combos (attraction_1_id, attraction_2_id, combo_price, discount_percent, active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [attraction_1_id, attraction_2_id, combo_price, discount_percent, active]
  );
  return rows[0];
}

async function getComboById(combo_id) {
  const { rows } = await pool.query(
    `SELECT c.*, a1.title AS attraction_1_title, a2.title AS attraction_2_title
     FROM combos c
     JOIN attractions a1 ON a1.attraction_id = c.attraction_1_id
     JOIN attractions a2 ON a2.attraction_id = c.attraction_2_id
     WHERE c.combo_id = $1`,
    [combo_id]
  );
  return rows[0] || null;
}

async function listCombos({ active = null } = {}) {
  const where = [];
  const params = [];
  if (active != null) {
    where.push('c.active = $1');
    params.push(Boolean(active));
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `
    SELECT c.*, a1.title AS attraction_1_title, a2.title AS attraction_2_title
    FROM combos c
    JOIN attractions a1 ON a1.attraction_id = c.attraction_1_id
    JOIN attractions a2 ON a2.attraction_id = c.attraction_2_id
    ${whereSql}
    ORDER BY c.created_at DESC
    `,
    params
  );
  return rows;
}

async function updateCombo(combo_id, fields = {}) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return getComboById(combo_id);

  const sets = [];
  const params = [];
  entries.forEach(([k, v], idx) => {
    sets.push(`${k} = $${idx + 1}`);
    params.push(v);
  });
  params.push(combo_id);

  const { rows } = await pool.query(
    `UPDATE combos SET ${sets.join(', ')}, updated_at = NOW()
     WHERE combo_id = $${params.length}
     RETURNING *`,
    params
  );
  return rows[0] || null;
}

async function deleteCombo(combo_id) {
  const { rowCount } = await pool.query(`DELETE FROM combos WHERE combo_id = $1`, [combo_id]);
  return rowCount > 0;
}

module.exports = {
  createCombo,
  getComboById,
  listCombos,
  updateCombo,
  deleteCombo,
};