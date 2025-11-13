const logger = require('../config/logger');
const { pool } = require('../config/db');
const payphiService = require('../services/payphiService');
const ticketService = require('../services/ticketService');
const cartService = require('../services/cartService');
const ticketEmailService = require('../services/ticketEmailService');

module.exports = async (req, res) => {
  try {
    const tranCtx = String(req.query.tranCtx || '').trim();
    if (!tranCtx) return res.status(400).send('Missing tranCtx');

    const q = await pool.query(
      `SELECT booking_id, booking_ref, final_amount, payment_status
       FROM bookings
       WHERE payment_ref = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [tranCtx]
    );
    const b = q.rows[0];
    let handled = false;
    let success = false;

    if (b) {
      const st = await payphiService.status({
        merchantTxnNo: b.booking_ref,
        originalTxnNo: b.booking_ref,
        amount: b.final_amount,
      });
      success = st.success;
      if (success && b.payment_status !== 'Completed') {
        await pool.query(
          `UPDATE bookings SET payment_status = 'Completed', updated_at = NOW() WHERE booking_id = $1`,
          [b.booking_id]
        );
        try {
          const urlPath = await ticketService.generateTicket(b.booking_id);
          await pool.query(`UPDATE bookings SET ticket_pdf = $1, updated_at = NOW() WHERE booking_id = $2`, [urlPath, b.booking_id]);
          try { await ticketEmailService.sendTicketEmail(b.booking_id); } catch (e) {}
        } catch (e) {}
        logger.info('PayPhi return: booking marked paid', { booking_id: b.booking_id });
      }
      const envClient = process.env.CLIENT_URL || '';
      const redirectBase = envClient && envClient !== 'null' ? envClient : 'http://localhost:5173';
      const redirectTo = `${redirectBase}/payment/return?booking_id=${encodeURIComponent(
        b.booking_id
      )}&status=${success ? 'success' : 'pending'}&tx=${encodeURIComponent(tranCtx)}`;
      handled = true;
      return res.redirect(redirectTo);
    }

    const qc = await pool.query(
      `SELECT cart_id, cart_ref, final_amount, payment_status, status, user_id
       FROM carts
       WHERE payment_ref = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [tranCtx]
    );
    const c = qc.rows[0];
    if (c) {
      const st = await payphiService.status({
        merchantTxnNo: c.cart_ref,
        originalTxnNo: c.cart_ref,
        amount: c.final_amount,
      });
      success = st.success;
      if (success && c.payment_status !== 'Completed') {
        await pool.query(
          `UPDATE carts SET payment_status = 'Completed', status = 'Paid', updated_at = NOW() WHERE cart_id = $1`,
          [c.cart_id]
        );
        try {
          const bookings = await cartService.createBookingsFromCart(c.cart_id, c.user_id);
          // Generate ticket + email for each
          for (const bk of bookings) {
            try {
              const urlPath = await ticketService.generateTicket(bk.booking_id);
              await pool.query(
                `UPDATE bookings SET ticket_pdf = $1, updated_at = NOW() WHERE booking_id = $2`,
                [urlPath, bk.booking_id]
              );
              try { await ticketEmailService.sendTicketEmail(bk.booking_id); } catch (e) {}
            } catch (e) {}
          }
        } catch (e) {
        }
        logger.info('PayPhi return: cart marked paid', { cart_id: c.cart_id });
      }
      const envClient = process.env.CLIENT_URL || '';
      const redirectBase = envClient && envClient !== 'null' ? envClient : 'http://localhost:5173';
      const redirectTo = `${redirectBase}/payment/return?cart=${encodeURIComponent(
        c.cart_ref
      )}&status=${success ? 'success' : 'pending'}&tx=${encodeURIComponent(tranCtx)}`;
      handled = true;
      return res.redirect(redirectTo);
    }

    if (!handled) {
      logger.warn('PayPhi return: no entity found for tranCtx', { tranCtx });
      return res.status(200).send('OK');
    }
  } catch (err) {
    logger.error('PayPhi return error', { err: err.message });
    return res.status(200).send('OK');
  }
};