// webhooks/payphi.notify.js
const logger = require('../config/logger');
const { pool } = require('../config/db');
const bookingService = require('../services/bookingService');
const payphiService = require('../services/payphiService');

module.exports = async (req, res) => {
  try {
    // PayPhi sends data in body for S2S notification
    const payload = req.body || {};
    const merchantTxnNo = payload.merchantTxnNo;
    
    if (!merchantTxnNo) {
        return res.status(400).send('Invalid Request');
    }

    logger.info('PayPhi Notify received', { merchantTxnNo, status: payload.paymentStatus });

    // 1. Find Order
    const q = await pool.query(
      `SELECT order_id, order_ref, payment_status, final_amount 
       FROM orders WHERE order_ref = $1`,
      [merchantTxnNo]
    );
    const order = q.rows[0];

    if (!order) {
      logger.error('PayPhi Notify: Order not found', { merchantTxnNo });
      return res.status(404).send('Order not found');
    }

    if (order.payment_status === 'Completed') {
      return res.status(200).send('OK'); // Already processed
    }

    // 2. Verify Status via API (Don't trust webhook body blindly)
    const { success, raw } = await payphiService.status({
        merchantTxnNo: order.order_ref,
        originalTxnNo: order.order_ref,
        amount: order.final_amount
    });

    // 3. Process logic (DB update + Tickets)
    if (success) {
        await bookingService.checkPayPhiStatus(order.order_id);
        logger.info('PayPhi Notify: Order completed successfully', { order_id: order.order_id });
    } else {
        logger.warn('PayPhi Notify: Verification failed', { order_id: order.order_id });
    }

    return res.status(200).send('OK');

  } catch (err) {
    logger.error('PayPhi Notify Error', { err: err.message });
    return res.status(500).send('Internal Error');
  }
};