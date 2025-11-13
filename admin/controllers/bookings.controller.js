// admin/controllers/bookings.controller.js
const { pool } = require('../../config/db');
const bookingsModel = require('../../models/bookings.model');
const bookingService = require('../../services/bookingService');
const payphiService = require('../../services/payphiService');
const { createApiLog } = require('../../models/apiLogs.model');
const ticketService = require('../../services/ticketService');

// Helpers
function isRoot(req) {
  const roles = (req.user?.roles || []).map((r) => String(r).toLowerCase());
  return roles.includes('root') || roles.includes('superadmin');
}
function allowedAttractions(req) {
  return req.user?.scopes?.attraction || [];
}

async function listBookings(req, res, next) {
  try {
    const {
      search = '',
      payment_status,
      booking_status,
      user_email,
      user_phone,
      attraction_id,
      page = '1',
      limit = '20',
    } = req.query;

    // Scoping
    const root = isRoot(req);
    const scoped = allowedAttractions(req);
    if (!root && scoped.length === 0) {
      return res.json({ data: [], meta: { page: 1, limit: 0, total: 0 } });
    }
    if (!root && attraction_id && !scoped.includes(Number(attraction_id))) {
      // Optional: return empty; or 403 to be explicit
      return res.status(403).json({ error: 'Forbidden: attraction not in scope' });
    }

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const off = (p - 1) * l;

    const where = [];
    const params = [];
    let i = 1;

    if (search) { where.push(`(b.booking_ref ILIKE $${i})`); params.push(`%${search}%`); i++; }
    if (payment_status) { where.push(`b.payment_status = $${i}`); params.push(payment_status); i++; }
    if (booking_status) { where.push(`b.booking_status = $${i}`); params.push(booking_status); i++; }
    if (user_email) { where.push(`u.email ILIKE $${i}`); params.push(`%${user_email}%`); i++; }
    if (user_phone) { where.push(`u.phone ILIKE $${i}`); params.push(`%${user_phone}%`); i++; }
    if (attraction_id) { where.push(`b.attraction_id = $${i}`); params.push(Number(attraction_id)); i++; }

    // Apply scope for non-root
    if (!root) {
      where.push(`b.attraction_id = ANY($${i}::bigint[])`);
      params.push(scoped);
      i++;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const dataSql = `
      SELECT
        b.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
        a.title AS attraction_title
      FROM bookings b
      LEFT JOIN users u ON u.user_id = b.user_id
      LEFT JOIN attractions a ON a.attraction_id = b.attraction_id
      ${whereSql}
      ORDER BY b.created_at DESC
      LIMIT $${i} OFFSET $${i + 1}
    `;
    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM bookings b
      LEFT JOIN users u ON u.user_id = b.user_id
      ${whereSql}
    `;

    const [rowsRes, countRes] = await Promise.all([
      pool.query(dataSql, [...params, l, off]),
      pool.query(countSql, params),
    ]);

    res.json({
      data: rowsRes.rows,
      meta: { page: p, limit: l, total: countRes.rows[0]?.count || 0 },
    });
  } catch (err) {
    next(err);
  }
}

async function getBookingById(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT
         b.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
         a.title AS attraction_title
       FROM bookings b
       LEFT JOIN users u ON u.user_id = b.user_id
       LEFT JOIN attractions a ON a.attraction_id = b.attraction_id
       WHERE b.booking_id = $1`,
      [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Booking not found' });

    // Scope check
    if (!isRoot(req)) {
      const scoped = allowedAttractions(req);
      if (row.attraction_id && !scoped.includes(Number(row.attraction_id))) {
        return res.status(403).json({ error: 'Forbidden: attraction not in scope' });
      }
    }

    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function createManualBooking(req, res, next) {
  try {
    const {
      user_id = null,
      attraction_id,
      slot_id = null,
      quantity = 1,
      addons = [],
      coupon_code = null,
      payment_mode = 'Offline',
      booking_date = null,
      markPaid = false,
    } = req.body || {};

    // Scope check
    if (!isRoot(req)) {
      const scoped = allowedAttractions(req);
      if (attraction_id && !scoped.includes(Number(attraction_id))) {
        return res.status(403).json({ error: 'Forbidden: attraction not in scope' });
      }
    }

    const booking = await bookingService.createBooking({
      user_id,
      attraction_id,
      slot_id,
      quantity,
      addons,
      coupon_code,
      payment_mode,
      booking_date,
    });

    if (markPaid) {
      await bookingsModel.setPayment(booking.booking_id, {
        payment_status: 'Completed',
        payment_ref: booking.booking_ref,
      });
      try {
        const urlPath = await ticketService.generateTicket(booking.booking_id);
        await bookingsModel.updateBooking(booking.booking_id, { ticket_pdf: urlPath });
      } catch (e) {
        // non-fatal
      }
    }

    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
}

async function updateBooking(req, res, next) {
  try {
    const id = Number(req.params.id);

    // Load current and scope-check
    const current = await bookingsModel.getBookingById(id);
    if (!current) return res.status(404).json({ error: 'Booking not found' });

    if (!isRoot(req)) {
      const scoped = allowedAttractions(req);
      const targetAttractionId = req.body?.attraction_id != null ? Number(req.body.attraction_id) : current.attraction_id;
      if (targetAttractionId && !scoped.includes(Number(targetAttractionId))) {
        return res.status(403).json({ error: 'Forbidden: attraction not in scope' });
      }
    }

    const allowed = [
      'user_id',
      'attraction_id',
      'slot_id',
      'booking_date',
      'booking_time',
      'total_amount',
      'discount_amount',
      'payment_status',
      'payment_mode',
      'payment_ref',
      'booking_status',
      'ticket_pdf',
      'whatsapp_sent',
      'email_sent',
    ];
    const payload = {};
    for (const k of allowed) {
      if (req.body && req.body[k] !== undefined) payload[k] = req.body[k];
    }

    // Optional guard: require payment_ref if marking Completed
    if (payload.payment_status === 'Completed' && !payload.payment_ref) {
      return res.status(400).json({ error: 'payment_ref is required for Completed payments' });
    }

    const updated = await bookingsModel.updateBooking(id, payload);
    if (!updated) return res.status(404).json({ error: 'Booking not found' });

    if (payload.payment_status === 'Completed') {
      try {
        const urlPath = await ticketService.generateTicket(id);
        await bookingsModel.updateBooking(id, { ticket_pdf: urlPath });
      } catch (e) {
        // non-fatal
      }
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function cancelBooking(req, res, next) {
  try {
    const id = Number(req.params.id);

    // Scope check
    const row = await bookingsModel.getBookingById(id);
    if (!row) return res.status(404).json({ error: 'Booking not found' });
    if (!isRoot(req)) {
      const scoped = allowedAttractions(req);
      if (row.attraction_id && !scoped.includes(Number(row.attraction_id))) {
        return res.status(403).json({ error: 'Forbidden: attraction not in scope' });
      }
    }

    const updated = await bookingService.cancelBooking(id);
    if (!updated) return res.status(404).json({ error: 'Booking not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteBooking(req, res, next) {
  try {
    const id = Number(req.params.id);

    // Scope check
    const row = await bookingsModel.getBookingById(id);
    if (!row) return res.status(404).json({ error: 'Booking not found' });
    if (!isRoot(req)) {
      const scoped = allowedAttractions(req);
      if (row.attraction_id && !scoped.includes(Number(row.attraction_id))) {
        return res.status(403).json({ error: 'Forbidden: attraction not in scope' });
      }
    }

    const { rowCount } = await pool.query(`DELETE FROM bookings WHERE booking_id = $1`, [id]);
    res.json({ deleted: rowCount > 0 });
  } catch (err) {
    next(err);
  }
}

async function checkPayPhiStatusAdmin(req, res, next) {
  try {
    const id = Number(req.params.id);

    // Scope check
    const row = await bookingsModel.getBookingById(id);
    if (!row) return res.status(404).json({ error: 'Booking not found' });
    if (!isRoot(req)) {
      const scoped = allowedAttractions(req);
      if (row.attraction_id && !scoped.includes(Number(row.attraction_id))) {
        return res.status(403).json({ error: 'Forbidden: attraction not in scope' });
      }
    }

    const out = await bookingService.checkPayPhiStatus(id);
    await createApiLog({
      endpoint: 'payphi_status_admin',
      payload: { booking_id: id, response: out.response },
      response_code: 200,
      status: out.success ? 'success' : 'failed',
    });
    res.json(out);
  } catch (err) {
    next(err);
  }
}

async function initiatePayPhiPaymentAdmin(req, res, next) {
  try {
    const id = Number(req.params.id);
    const b = await bookingsModel.getBookingById(id);
    if (!b) return res.status(404).json({ error: 'Booking not found' });

    // Scope check
    if (!isRoot(req)) {
      const scoped = allowedAttractions(req);
      if (b.attraction_id && !scoped.includes(Number(b.attraction_id))) {
        return res.status(403).json({ error: 'Forbidden: attraction not in scope' });
      }
    }

    const { email, mobile } = (req.body && typeof req.body === 'object') ? req.body : {};
    if (!email || !mobile) return res.status(400).json({ error: 'email and mobile are required' });
    const out = await bookingService.initiatePayPhiPayment(id, { email, mobile, addlParam1: String(id), addlParam2: 'SnowCity' });
    res.json(out);
  } catch (err) {
    next(err);
  }
}

async function refundPayPhi(req, res, next) {
  try {
    const id = Number(req.params.id);
    const b = await bookingsModel.getBookingById(id);
    if (!b) return res.status(404).json({ error: 'Booking not found' });

    // Scope check
    if (!isRoot(req)) {
      const scoped = allowedAttractions(req);
      if (b.attraction_id && !scoped.includes(Number(b.attraction_id))) {
        return res.status(403).json({ error: 'Forbidden: attraction not in scope' });
      }
    }

    if (b.payment_status !== 'Completed') return res.status(400).json({ error: 'Cannot refund: payment is not completed' });

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

    const newMerchantTxnNo = req.body?.newMerchantTxnNo || `${b.booking_ref}R${Date.now().toString().slice(-6)}`;
    const { success, raw } = await payphiService.refund({
      newMerchantTxnNo,
      originalTxnNo: b.booking_ref,
      amount,
    });

    await createApiLog({
      endpoint: 'payphi_refund_admin',
      payload: { booking_id: id, newMerchantTxnNo, originalTxnNo: b.booking_ref, amount, response: raw },
      response_code: 200,
      status: success ? 'success' : 'failed',
    });

    res.json({ success, newMerchantTxnNo, response: raw });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listBookings,
  getBookingById,
  createManualBooking,
  updateBooking,
  cancelBooking,
  deleteBooking,
  checkPayPhiStatusAdmin,
  initiatePayPhiPaymentAdmin,
  refundPayPhi,
};