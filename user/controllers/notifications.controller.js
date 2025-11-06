const { pool } = require('../../config/db');

// GET /api/notifications
exports.listMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { status, channel, q = '', from, to } = req.query;
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;

    const where = ['n.user_id = $1'];
    const params = [userId];
    let i = 2;

    if (status) {
      where.push(`n.status = $${i++}`);
      params.push(status);
    }
    if (channel) {
      where.push(`n.channel = $${i++}`);
      params.push(channel);
    }
    if (q) {
      where.push(`n.message ILIKE $${i++}`);
      params.push(`%${q}%`);
    }
    if (from) {
      where.push(`n.created_at >= $${i++}::timestamptz`);
      params.push(from);
    }
    if (to) {
      where.push(`n.created_at < $${i++}::timestamptz`);
      params.push(to);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const dataSql = `
      SELECT
        n.notification_id, n.user_id, n.booking_id, n.channel, n.status,
        n.message, n.sent_at, n.created_at, n.updated_at
      FROM notifications n
      ${whereSql}
      ORDER BY n.created_at DESC
      LIMIT $${i} OFFSET $${i + 1};
    `;
    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM notifications n
      ${whereSql};
    `;

    const dataParams = params.concat([limit, offset]);

    const [rowsRes, countRes] = await Promise.all([
      pool.query(dataSql, dataParams),
      pool.query(countSql, params),
    ]);

    const total = countRes.rows[0]?.count || 0;

    res.json({
      data: rowsRes.rows,
      meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/notifications/:id
exports.getMyNotificationById = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT
         n.notification_id, n.user_id, n.booking_id, n.channel, n.status,
         n.message, n.sent_at, n.created_at, n.updated_at
       FROM notifications n
       WHERE n.notification_id = $1 AND n.user_id = $2
       LIMIT 1`,
      [id, userId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Notification not found' });

    res.json(row);
  } catch (err) {
    next(err);
  }
};