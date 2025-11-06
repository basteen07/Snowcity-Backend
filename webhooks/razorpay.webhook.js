const express = require('express');
const logger = require('../config/logger');
const { verifyWebhookSignature } = require('../config/razorpay');
const { pool } = require('../config/db');

// Important: This route uses express.raw to access the raw body for signature verification.
// Ensure this route is mounted before a global express.json() OR export as an array (as below).
module.exports = [
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const signature = req.headers['x-razorpay-signature'] || req.headers['X-Razorpay-Signature'];
      const payloadStr = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
      const isValid = verifyWebhookSignature(payloadStr, signature || '');

      if (!isValid) {
        logger.warn('Razorpay webhook: invalid signature');
        return res.status(400).send('Invalid signature');
      }

      let body;
      try {
        body = JSON.parse(payloadStr);
      } catch (e) {
        logger.warn('Razorpay webhook: invalid JSON payload');
        return res.status(200).send('ok'); // ack anyway
      }

      const event = String(body.event || '').toLowerCase();

      // Extract references
      const paymentEntity = body.payload?.payment?.entity || {};
      const orderEntity = body.payload?.order?.entity || {};

      const paymentId = paymentEntity.id || null;
      const orderId = paymentEntity.order_id || orderEntity.id || null;

      // We used 'receipt' when creating the order -> booking_ref
      const bookingRef =
        orderEntity.receipt ||
        paymentEntity.notes?.booking_ref ||
        paymentEntity.notes?.bookingId ||
        paymentEntity.notes?.booking_id ||
        paymentEntity.notes?.receipt ||
        null;

      logger.info('Razorpay webhook received', { event, orderId, paymentId, bookingRef });

      // Mark booking paid on certain events
      const shouldMarkPaid =
        event === 'payment.captured' ||
        event === 'payment.authorized' ||
        event === 'order.paid';

      if (shouldMarkPaid && bookingRef) {
        const upd = await pool.query(
          `UPDATE bookings
             SET payment_status = 'Completed',
                 payment_ref = COALESCE($2, payment_ref),
                 updated_at = NOW()
           WHERE booking_ref = $1
           RETURNING booking_id, booking_ref`,
          [bookingRef, paymentId]
        );

        if (upd.rowCount > 0) {
          logger.info('Booking marked paid (Razorpay)', { booking_ref: bookingRef, paymentId });
        } else {
          logger.warn('Booking not found for booking_ref (Razorpay)', { booking_ref: bookingRef });
        }
      }

      return res.status(200).send('ok');
    } catch (err) {
      logger.error('Razorpay webhook error', { err: err.message });
      return res.status(200).send('ok'); // Always ACK to avoid retries storm
    }
  },
];