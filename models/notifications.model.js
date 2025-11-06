const { pool } = require('../config/db');

function mapNotification(row) {
  if (!row) return null;
  return {
    notification_id: row.notification_id,
    user_id: row.user_id,
    booking_id: row.booking_id,
    channel: row.channel,
    status: row.status,
    message: row.message,
    sent_at: row.sent_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createNotification({ user_id = null, booking_id = null, channel, message, status = 'pending' }) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, booking_id, channel, status, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [user_id, booking_id, channel, status, message]
  );
  return mapNotification(rows[0]);
}

async function getNotificationById(notification_id) {
  const { rows } = await pool.query(`SELECT * FROM notifications WHERE notification_id = $1`, [notification_id]);
  return mapNotification(rows[0]);
}

async function listNotifications({ user_id = null, booking_id = null, status = null, channel = null, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (user_id) {
    where.push(`n.user_id = $${i++}`);
    params.push(Number(user_id));
  }
  if (booking_id) {
    where.push(`n.booking_id = $${i++}`);
    params.push(Number(booking_id));
  }
  if (status) {
    where.push(`n.status = $${i++}`);
    params.push(status);
  }
  if (channel) {
    where.push(`n.channel = $${i++}`);
    params.push(channel);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT n.*
     FROM notifications n
     ${whereSql}
     ORDER BY n.created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );
  return rows.map(mapNotification);
}

async function setStatus(notification_id, status) {
  const { rows } = await pool.query(
    `UPDATE notifications SET status = $1, updated_at = NOW()
     WHERE notification_id = $2
     RETURNING *`,
    [status, notification_id]
  );
  return mapNotification(rows[0]);
}

async function markSent(notification_id) {
  const { rows } = await pool.query(
    `UPDATE notifications SET status = 'sent', sent_at = NOW(), updated_at = NOW()
     WHERE notification_id = $1 RETURNING *`,
    [notification_id]
  );
  return mapNotification(rows[0]);
}

async function deleteNotification(notification_id) {
  const { rowCount } = await pool.query(`DELETE FROM notifications WHERE notification_id = $1`, [notification_id]);
  return rowCount > 0;
}

module.exports = {
  createNotification,
  getNotificationById,
  listNotifications,
  setStatus,
  markSent,
  deleteNotification,
};