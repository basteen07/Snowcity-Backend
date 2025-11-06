const twilio = require('twilio');
const logger = require('./logger');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client =
  accountSid && authToken
    ? twilio(accountSid, authToken)
    : null;

if (!client) {
  logger.warn('Twilio client not initialized. Missing credentials.');
}

async function sendSMS({ to, body }) {
  if (!client) throw new Error('Twilio not configured');
  const from = process.env.TWILIO_PHONE_NUMBER;
  const resp = await client.messages.create({ from, to, body });
  logger.info('SMS sent', { sid: resp.sid, to });
  return resp;
}

async function sendWhatsApp({ to, body }) {
  if (!client) throw new Error('Twilio not configured');
  const from = process.env.TWILIO_PHONE_NUMBER.startsWith('whatsapp:')
    ? process.env.TWILIO_PHONE_NUMBER
    : `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;
  const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const resp = await client.messages.create({ from, to: toWa, body });
  logger.info('WhatsApp message sent', { sid: resp.sid, to: toWa });
  return resp;
}

module.exports = {
  client,
  sendSMS,
  sendWhatsApp,
};