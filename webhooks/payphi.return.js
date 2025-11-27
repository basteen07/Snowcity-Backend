const logger = require('../config/logger');
const { pool } = require('../config/db');
const bookingService = require('../services/bookingService');

const pickTranCtx = (payload = {}) => {
  const entries = Object.entries(payload || {});
  for (const [key, value] of entries) {
    if (!key) continue;
    if (key.toLowerCase() === 'tranctx') {
      const val = String(value || '').trim();
      if (val) return val;
    }
  }
  return '';
};

const pickValue = (payload = {}, target = '') => {
  if (!target) return undefined;
  const t = target.toLowerCase();
  for (const [key, value] of Object.entries(payload || {})) {
    if ((key || '').toLowerCase() === t) return value;
  }
  return undefined;
};

const resolveClientBaseUrl = () => {
  const raw = process.env.CLIENT_URL || '';
  const entries = raw
    .split(',')
    .map((val) => String(val || '').trim())
    .filter(Boolean);
  const fallback = 'https://snowcity.netlify.app';
  const base = entries[0] || fallback;
  return base.replace(/\/$/, '');
};

const resolveAppBaseUrl = () => {
  const raw = process.env.APP_URL || '';
  const entries = raw
    .split(',')
    .map((val) => String(val || '').trim())
    .filter(Boolean);
  const fallback = process.env.APP_PUBLIC_URL || 'http://localhost:4000';
  const base = entries[0] || fallback;
  return base.replace(/\/$/, '');
};

const absoluteFromPath = (path = '') => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = resolveAppBaseUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
};

module.exports = async (req, res) => {
  try {
    const tranCtx = pickTranCtx(req.query) || pickTranCtx(req.body);
    const merchantTxnNoRaw =
      pickValue(req.query, 'merchantTxnNo') ||
      pickValue(req.body, 'merchantTxnNo') ||
      pickValue(req.query, 'merchantTxnno') ||
      pickValue(req.body, 'merchantTxnno');
    const merchantTxnNo = merchantTxnNoRaw ? String(merchantTxnNoRaw).trim() : '';

    if (!tranCtx && !merchantTxnNo) {
        logger.warn('PayPhi return: Missing tranCtx and merchantTxnNo');
        return res.status(400).send('Missing tranCtx');
    }

    // 1. Find the Order associated with this payment reference
    // Note: In the initiate step, we stored tranCtx into orders.payment_ref
    let order = null;

    if (tranCtx) {
      const q = await pool.query(
        `SELECT order_id, order_ref, payment_status
         FROM orders
         WHERE payment_ref = $1
         LIMIT 1`,
        [tranCtx]
      );
      order = q.rows[0] || null;
    }

    if (!order && merchantTxnNo) {
      const byTxn = await pool.query(
        `SELECT order_id, order_ref, payment_status
         FROM orders
         WHERE order_ref = $1
         LIMIT 1`,
        [merchantTxnNo]
      );
      order = byTxn.rows[0] || null;
    }

    if (!order) {
      logger.warn('PayPhi return: Order not found for tranCtx', { tranCtx });
      // Even if not found, standard practice is to redirect user to home or error page 
      // rather than leaving them on a JSON response, but for webhook logic 'OK' is fine.
      // For a browser redirect endpoint:
      return res.redirect(`${process.env.CLIENT_URL || ''}/payment/return?status=failed&reason=not_found`);
    }

    // 2. Trigger the Service Logic
    // This handles: API check, DB Updates (Order + Bookings), Ticket Generation, Emailing
    let success = false;
    try {
        const statusResult = await bookingService.checkPayPhiStatus(order.order_id);
        success = statusResult.success;
        logger.info('PayPhi return: Check status complete', { order_id: order.order_id, success });
    } catch (svcErr) {
        logger.error('PayPhi return: Service verification failed', { err: svcErr.message });
        // If service fails, we assume payment isn't confirmed yet
    }

    // 3. Redirect to Client
    const prefix = resolveClientBaseUrl();

    if (success) {
      let primaryBookingId = null;
      let ticketPath = null;
      try {
        const bookingRef = await pool.query(
          'SELECT booking_id, ticket_pdf FROM bookings WHERE order_id = $1 ORDER BY booking_id ASC LIMIT 1',
          [order.order_id]
        );
        const firstBooking = bookingRef.rows[0];
        primaryBookingId = firstBooking?.booking_id || null;
        ticketPath = firstBooking?.ticket_pdf || null;

        if (!ticketPath) {
          const ticketRes = await pool.query(
            'SELECT ticket_pdf FROM bookings WHERE order_id = $1 AND ticket_pdf IS NOT NULL ORDER BY booking_id ASC LIMIT 1',
            [order.order_id]
          );
          ticketPath = ticketRes.rows[0]?.ticket_pdf || null;
        }
      } catch (lookupErr) {
        logger.warn('PayPhi return: Failed to fetch primary booking for success redirect', { err: lookupErr.message });
      }

      const params = new URLSearchParams();
      if (primaryBookingId) params.set('booking', primaryBookingId);
      params.set('cart', order.order_ref);
      if (tranCtx) params.set('tx', tranCtx);
      const absTicketUrl = absoluteFromPath(ticketPath);
      if (absTicketUrl) params.set('ticket', absTicketUrl);

      const successUrl = `${prefix}/payment/success?${params.toString()}`;
      return res.redirect(successUrl);
    }

    const fallbackUrl = `${prefix}/payment/return?order=${encodeURIComponent(
      order.order_ref
    )}&status=pending`;

    return res.redirect(fallbackUrl);

  } catch (err) {
    logger.error('PayPhi return error', { err: err.message });
    // Fallback redirect
    return res.redirect(`${process.env.CLIENT_URL || ''}/payment/return?status=error`);
  }
};