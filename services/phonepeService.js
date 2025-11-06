const phonepe = require('../config/phonepe');

async function initiate({ merchantTransactionId, amount, mobileNumber, callbackUrl, instrument }) {
  return phonepe.initiatePayment({ merchantTransactionId, amount, mobileNumber, callbackUrl, instrument });
}

async function status(merchantTransactionId) {
  return phonepe.checkStatus(merchantTransactionId);
}

function verifyWebhook(req) {
  return phonepe.verifyWebhookSignature(req);
}

module.exports = {
  initiate,
  status,
  verifyWebhook,
  baseURL: phonepe.baseURL,
};