const crypto = require('crypto');
const createHttpClient = require('./axios');
const logger = require('./logger');

const PHONEPE_ENV = (process.env.PHONEPE_ENV || 'sandbox').toLowerCase();

// API bases per env
const BASES = {
  sandbox: 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1',
  production: 'https://api.phonepe.com/apis/hermes/pg/v1',
};

const baseURL = BASES[PHONEPE_ENV] || BASES.sandbox;

const client = createHttpClient({
  baseURL,
  timeout: 20000,
});

const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || '';
const MERCHANT_USER_ID = process.env.PHONEPE_MERCHANT_USER_ID || '';
const SALT_KEY = process.env.PHONEPE_SALT_KEY || '';
const SALT_INDEX = String(process.env.PHONEPE_SALT_INDEX || '1');

function makeXVerify(payloadBase64, apiPath) {
  // x-VERIFY = sha256(base64Payload + apiPath + saltKey) + ### + saltIndex
  const toSign = payloadBase64 + apiPath + SALT_KEY;
  const sha = crypto.createHash('sha256').update(toSign).digest('hex');
  return `${sha}###${SALT_INDEX}`;
}

async function initiatePayment({
  merchantTransactionId,
  amount, // in paisa
  mobileNumber,
  callbackUrl = process.env.PHONEPE_CALLBACK_URL,
  instrument = { type: 'UPI_INTENT' },
}) {
  const apiPath = '/pay';
  const body = {
    merchantId: MERCHANT_ID,
    merchantTransactionId,
    merchantUserId: MERCHANT_USER_ID,
    amount,
    redirectUrl: callbackUrl,
    redirectMode: 'POST',
    callbackUrl,
    mobileNumber,
    paymentInstrument: instrument,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(body)).toString('base64');
  const xVerify = makeXVerify(payloadBase64, apiPath);

  const resp = await client.post(apiPath, payloadBase64, {
    headers: {
      'Content-Type': 'application/json',
      'X-VERIFY': xVerify,
      'X-MERCHANT-ID': MERCHANT_ID,
    },
  });

  logger.info('PhonePe initiate response', { code: resp.data?.code, success: resp.data?.success });
  return resp.data;
}

async function checkStatus(merchantTransactionId) {
  const apiPath = `/status/${MERCHANT_ID}/${merchantTransactionId}`;
  const xVerify = makeXVerify('', apiPath); // status uses empty payload

  const resp = await client.get(apiPath, {
    headers: {
      'Content-Type': 'application/json',
      'X-VERIFY': xVerify,
      'X-MERCHANT-ID': MERCHANT_ID,
    },
  });

  logger.info('PhonePe status response', { code: resp.data?.code, success: resp.data?.success });
  return resp.data;
}

function verifyWebhookSignature(req) {
  // Typically x-VERIFY header or x-VERIFY-SHA256 provided by PhonePe
  const signature = req.headers['x-verify'] || req.headers['x-verify-sha256'];
  if (!signature) return false;
  // For webhooks, construct according to PhonePe docs (may vary by integration).
  // Often: sha256(base64Payload + saltKey) + ### + saltIndex
  const payload = JSON.stringify(req.body || {});
  const payloadBase64 = Buffer.from(payload).toString('base64');
  const expected = `${crypto.createHash('sha256').update(payloadBase64 + SALT_KEY).digest('hex')}###${SALT_INDEX}`;
  return signature === expected;
}

module.exports = {
  initiatePayment,
  checkStatus,
  verifyWebhookSignature,
  baseURL,
};