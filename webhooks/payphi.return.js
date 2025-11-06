const logger = require('../config/logger');
const { pool } = require('../config/db');
const payphiService = require('../services/payphiService');

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
    if (!b) {
      logger.warn('PayPhi return: booking not found for tranCtx', { tranCtx });
      return res.status(200).send('OK');
    }

    const { success } = await payphiService.status({
      merchantTxnNo: b.booking_ref,
      originalTxnNo: b.booking_ref,
      amount: b.final_amount,
    });

    if (success && b.payment_status !== 'Completed') {
      await pool.query(
        `UPDATE bookings SET payment_status = 'Completed', updated_at = NOW() WHERE booking_id = $1`,
        [b.booking_id]
      );
      logger.info('PayPhi return: booking marked paid', { booking_id: b.booking_id });
    }

    const client = process.env.CLIENT_URL || '';
    const redirectTo = `${client}/payment/return?booking=${encodeURIComponent(
      b.booking_ref
    )}&status=${success ? 'success' : 'pending'}`;

    return res.redirect(redirectTo);
  } catch (err) {
    logger.error('PayPhi return error', { err: err.message });
    return res.status(200).send('OK');
  }
};