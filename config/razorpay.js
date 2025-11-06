const Razorpay = require('razorpay');
const crypto = require('crypto');
const logger = require('./logger');

const key_id = process.env.RAZORPAY_KEY_ID || '';
const key_secret = process.env.RAZORPAY_KEY_SECRET || '';

const razorpay =
  key_id && key_secret
    ? new Razorpay({ key_id, key_secret })
    : null;

if (!razorpay) {
  logger.warn('Razorpay client not initialized. Missing credentials.');
}

async function createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  if (!razorpay) throw new Error('Razorpay not configured');
  // amount in paise
  const order = await razorpay.orders.create({ amount, currency, receipt, notes, payment_capture: 1 });
  logger.info('Razorpay order created', { id: order.id, amount, currency });
  return order;
}

function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', key_secret).update(body).digest('hex');
  return expected === signature;
}

function verifyWebhookSignature(payload, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  return expected === signature;
}

module.exports = {
  razorpay,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
};