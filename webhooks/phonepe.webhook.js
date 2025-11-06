const express = require('express');
const logger = require('../config/logger');
const phonepe = require('../config/phonepe');
const { pool } = require('../config/db');

// PhonePe typically posts JSON with signature in headers.
// Our verifyWebhookSignature(req) computes expected signature from the JSON body.
module.exports = [
  express.json({ type: 'application/json' }),
  async (req, res) => {
    try {
      const verified = phonepe.verifyWebhookSignature(req);
      if (!verified) {
        logger.warn('PhonePe webhook: invalid signature');
        return res.status(400).send('Invalid signature');
      }

      const payload = req.body || {};
      const code = (payload.code || '').toUpperCase();
      const success = code === 'SUCCESS' || payload.success === true;

      const merchantTransactionId =
        payload.data?.merchantTransactionId ||
        payload.merchantTransactionId ||
        payload.transactionId ||
        null;

      logger.info('PhonePe webhook received', { code, success, merchantTransactionId });

      // We used booking_ref as merchantTransactionId
      if (merchantTransactionId && success) {
        const upd = await pool.query(
          `UPDATE bookings
             SET payment_status = 'Completed',
                 payment_ref = $2,
                 updated_at = NOW()
           WHERE booking_ref = $1
           RETURNING booking_id, booking_ref`,
          [merchantTransactionId, payload.data?.transactionId || merchantTransactionId]
        );
        if (upd.rowCount > 0) {
          logger.info('Booking marked paid (PhonePe)', { booking_ref: merchantTransactionId });
        } else {
          logger.warn('Booking not found for merchantTransactionId', { merchantTransactionId });
        }
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      logger.error('PhonePe webhook error', { err: err.message });
      // ACK anyway to prevent repeated retries; log for manual inspection
      return res.status(200).json({ received: true });
    }
  },
];