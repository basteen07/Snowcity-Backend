const { pool } = require('../../config/db');
const logger = require('../../config/logger');
const { sendMail } = require('../../config/mailer');
const { sendWhatsApp } = require('../../config/twilio');

function getPagination(query) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function deliverNotification(notif, user) {
  if (notif.channel === 'email') {
    const to = notif.to || user?.email;
    if (!to) throw new Error('Recipient email missing');
    const subject = notif.subject || 'SnowCity Notification';
    const html = notif.message || '';
    const text = html.replace(/<[^>]+>/g, '');
    await sendMail({ to, subject, html, text });
    return true;
  }
  if (notif.channel === 'whatsapp') {
    const to = notif.to || user?.phone;
    if (!to) throw new Error('Recipient phone missing');
    const body = notif.message || '';
    await sendWhatsApp({ to, body });
    return true;
  }
  throw new Error(`Unsupported channel: ${notif.channel}`);
}

exports.listNotifications = async (req, res, next) => {
  try {
    const { status, channel, user_id, booking_id, q = '', from, to } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = [];
    const params = [];
    let i = 1;

    if (status) { where.push(`n.status = $${i++}`); params.push(status); }
    if (channel) { where.push(`n.channel = $${i++}`); params.push(channel); }
    if (user_id) { where.push(`n.user_id = $${i++}`); params.push(Number(user_id)); }
    if (booking_id) { where.push(`n.booking_id = $${i++}`); params.push(Number(booking_id)); }
    if (q) { where.push(`n.message ILIKE $${i++}`); params.push(`%${q}%`); }
    if (from) { where.push(`n.created_at >= $${i++}::timestamptz`); params.push(from); }
    if (to) { where.push(`n.created_at < $${i++}::timestamptz`); params.push(to); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const dataSql = `
      SELECT
        n.notification_id, n.user_id, n.booking_id, n.channel, n.status,
        n.message, n.sent_at, n.created_at, n.updated_at,
        u.name AS user_name, u.email AS user_email, u.phone AS user_phone
      FROM notifications n
      LEFT JOIN users u ON u.user_id = n.user_id
      ${whereSql}
      ORDER BY n.created_at DESC
      LIMIT $${i} OFFSET $${i + 1};
    `;
    const countSql = `SELECT COUNT(*)::int AS count FROM notifications n ${whereSql};`;
    const dataParams = params.concat([limit, offset]);

    const [rowsRes, countRes] = await Promise.all([
      pool.query(dataSql, dataParams),
      pool.query(countSql, params),
    ]);

    const total = countRes.rows[0]?.count || 0;
    res.json({ data: rowsRes.rows, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
  } catch (err) {
    next(err);
  }
};

exports.getNotificationById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT
         n.notification_id, n.user_id, n.booking_id, n.channel, n.status,
         n.message, n.sent_at, n.created_at, n.updated_at,
         u.name AS user_name, u.email AS user_email, u.phone AS user_phone
       FROM notifications n
       LEFT JOIN users u ON u.user_id = n.user_id
       WHERE n.notification_id = $1`,
      [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Notification not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.createNotification = async (req, res, next) => {
  try {
    const { user_id = null, booking_id = null, channel, message, sendNow = false, to = null, subject = null } = req.body;
    if (!channel || !message) return res.status(400).json({ error: 'channel and message are required' });

    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, booking_id, channel, status, message)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING notification_id, user_id, booking_id, channel, status, message, sent_at, created_at, updated_at`,
      [user_id, booking_id, channel, message]
    );
    const notif = rows[0];

    if (sendNow) {
      const user = user_id
        ? (await pool.query(`SELECT user_id, email, phone FROM users WHERE user_id = $1`, [user_id])).rows[0]
        : null;

      try {
        await deliverNotification({ ...notif, to, subject }, user);
        const upd = await pool.query(
          `UPDATE notifications SET status = 'sent', sent_at = NOW(), updated_at = NOW()
           WHERE notification_id = $1 RETURNING *`,
          [notif.notification_id]
        );
        return res.status(201).json(upd.rows[0]);
      } catch (e) {
        await pool.query(
          `UPDATE notifications SET status = 'failed', updated_at = NOW() WHERE notification_id = $1`,
          [notif.notification_id]
        );
        return res.status(201).json({ ...notif, status: 'failed', error: e.message });
      }
    }

    res.status(201).json(notif);
  } catch (err) {
    next(err);
  }
};

exports.resendNotification = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const notifRes = await pool.query(
      `SELECT n.*, u.email AS user_email, u.phone AS user_phone
       FROM notifications n
       LEFT JOIN users u ON u.user_id = n.user_id
       WHERE n.notification_id = $1`,
      [id]
    );
    const notif = notifRes.rows[0];
    if (!notif) return res.status(404).json({ error: 'Notification not found' });

    try {
      const user = notif.user_id ? { email: notif.user_email, phone: notif.user_phone } : null;
      await deliverNotification({ channel: notif.channel, message: notif.message }, user);
      const upd = await pool.query(
        `UPDATE notifications SET status = 'sent', sent_at = NOW(), updated_at = NOW()
         WHERE notification_id = $1 RETURNING *`,
        [id]
      );
      res.json(upd.rows[0]);
    } catch (e) {
      await pool.query(
        `UPDATE notifications SET status = 'failed', updated_at = NOW() WHERE notification_id = $1`,
        [id]
      );
      res.status(500).json({ error: 'Delivery failed', message: e.message });
    }
  } catch (err) {
    next(err);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rowCount } = await pool.query(`DELETE FROM notifications WHERE notification_id = $1`, [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};